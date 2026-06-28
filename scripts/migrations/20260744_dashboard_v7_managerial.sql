-- ============================================================
-- Onda 3 — Dashboard Gerencial v7
--
-- ADITIVO. Mantem dashboard_metrics() (sem args) funcionando como
-- antes (delega para dashboard_metrics_v7('{}')). Acrescenta:
--   * tabelas org_goals (metas/custo por mes) e dashboard_snapshots
--   * RPC dashboard_metrics_v7(filters jsonb)
--       filtros: from, to, owner_name (=vendedor)
--       presets: hoje, ontem, semana, mes, trimestre, ano
--       novos KPIs gerenciais + series + ranking + metas + comparacao
--   * RPC dashboard_filters_options()
--   * RPC upsert_org_goal(...)
--   * Job diario via pg_cron (00:05) gravando snapshots por organizacao
-- ============================================================

begin;
set local check_function_bodies = off;

-- ------------------------------------------------------------
-- 1) Tabelas
-- ------------------------------------------------------------
create table if not exists public.org_goals (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  year             int  not null,
  month            int  not null check (month between 1 and 12),
  meta_receita     numeric(14,2) not null default 0,
  meta_clientes    int           not null default 0,
  meta_contatos    int           not null default 0,
  custo_marketing  numeric(14,2) not null default 0,
  updated_by       uuid references auth.users(id),
  updated_at       timestamptz not null default now(),
  primary key (organization_id, year, month)
);
grant select, insert, update, delete on public.org_goals to authenticated;
grant all on public.org_goals to service_role;
alter table public.org_goals enable row level security;
drop policy if exists "org_goals member rw" on public.org_goals;
create policy "org_goals member rw" on public.org_goals
  for all to authenticated
  using (exists (select 1 from public.organization_members m
                  where m.organization_id = org_goals.organization_id
                    and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m
                       where m.organization_id = org_goals.organization_id
                         and m.user_id = auth.uid()));

create table if not exists public.dashboard_snapshots (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_date   date not null,
  payload         jsonb not null,
  captured_at     timestamptz not null default now(),
  primary key (organization_id, snapshot_date)
);
grant select on public.dashboard_snapshots to authenticated;
grant all on public.dashboard_snapshots to service_role;
alter table public.dashboard_snapshots enable row level security;
drop policy if exists "snapshots member read" on public.dashboard_snapshots;
create policy "snapshots member read" on public.dashboard_snapshots
  for select to authenticated
  using (exists (select 1 from public.organization_members m
                  where m.organization_id = dashboard_snapshots.organization_id
                    and m.user_id = auth.uid()));
create index if not exists dashboard_snapshots_org_date_idx
  on public.dashboard_snapshots (organization_id, snapshot_date desc);

-- ------------------------------------------------------------
-- 2) Indices de apoio (filtragem por owner/data)
-- ------------------------------------------------------------
create index if not exists prospects_org_owner_idx
  on public.prospects (organization_id, owner_name);
create index if not exists prospects_org_created_idx
  on public.prospects (organization_id, created_at);
create index if not exists clients_org_owner_idx
  on public.clients (organization_id, owner_name);
create index if not exists clients_org_created_idx
  on public.clients (organization_id, created_at);
create index if not exists clients_org_updated_stage_idx
  on public.clients (organization_id, updated_at, pipeline_stage);
create index if not exists deals_client_closed_idx
  on public.deals (client_id, closed_at);

-- ------------------------------------------------------------
-- 3) Helpers de periodo (preset -> [from, to])
-- ------------------------------------------------------------
create or replace function public._dashboard_period(preset text)
returns table(p_from timestamptz, p_to timestamptz)
language plpgsql immutable as $$
declare
  d_today date := current_date;
begin
  case lower(coalesce(preset, ''))
    when 'hoje'      then return query select d_today::timestamptz,                       (d_today + 1)::timestamptz;
    when 'ontem'     then return query select (d_today - 1)::timestamptz,                  d_today::timestamptz;
    when 'semana'    then return query select date_trunc('week', now()),                  (date_trunc('week', now()) + interval '7 days');
    when 'mes'       then return query select date_trunc('month', now()),                 (date_trunc('month', now()) + interval '1 month');
    when 'trimestre' then return query select date_trunc('quarter', now()),               (date_trunc('quarter', now()) + interval '3 months');
    when 'ano'       then return query select date_trunc('year', now()),                  (date_trunc('year', now()) + interval '1 year');
    else             return query select date_trunc('month', now()),                      (date_trunc('month', now()) + interval '1 month');
  end case;
end $$;

-- ------------------------------------------------------------
-- 4) RPC principal — dashboard_metrics_v7(filters)
-- ------------------------------------------------------------
drop function if exists public.dashboard_metrics_v7(jsonb);
create function public.dashboard_metrics_v7(filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public as $func$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_preset text   := nullif(filters->>'preset', '');
  v_owner  text   := nullif(filters->>'owner_name', '');
  v_from   timestamptz;
  v_to     timestamptz;
  v_prev_from timestamptz;
  v_prev_to   timestamptz;
  v_now    timestamptz := now();
  v_year   int := extract(year  from now())::int;
  v_month  int := extract(month from now())::int;
begin
  if v_uid is null then raise exception 'auth_required' using errcode='28000'; end if;
  select organization_id into v_org from public.user_active_org where user_id = v_uid;
  if v_org is null then raise exception 'no_active_org' using errcode='P0001'; end if;
  if not exists (select 1 from public.organization_members
                  where organization_id = v_org and user_id = v_uid) then
    raise exception 'org_access_denied' using errcode='42501';
  end if;

  perform public.assert_pipeline_stages_mapped();

  -- Janela ativa
  if filters ? 'from' and (filters->>'from') is not null and (filters->>'from') <> '' then
    v_from := (filters->>'from')::timestamptz;
    v_to   := coalesce(nullif(filters->>'to','')::timestamptz, v_now);
  else
    select p_from, p_to into v_from, v_to from public._dashboard_period(coalesce(v_preset,'mes'));
  end if;
  -- Janela anterior (mesmo tamanho, deslocada)
  v_prev_to   := v_from;
  v_prev_from := v_from - (v_to - v_from);

  return (
  with
  -- Prospects no escopo
  p_scope as (
    select * from public.prospects
     where organization_id = v_org
       and (v_owner is null or owner_name = v_owner)
  ),
  -- Clients no escopo
  c_scope as (
    select * from public.clients
     where organization_id = v_org
       and (v_owner is null or owner_name = v_owner)
  ),
  -- Touchpoints no escopo (joinado p/ filtrar owner via prospect)
  t_scope as (
    select t.*
      from public.prospect_touchpoints t
      join p_scope p on p.id = t.prospect_id
     where t.organization_id = v_org
  ),
  -- Agregacoes basicas (compat v6)
  p_agg as (
    select
      count(*)::bigint as base,
      count(*) filter (where cadence_status = 'ativo' and next_contact_at < now())::bigint as cadencia_atrasada,
      count(*) filter (where last_contact_at < now() - interval '30 days')::bigint as parados_30d,
      count(*) filter (where nullif(owner_name,'') is null)::bigint as sem_responsavel
    from p_scope
  ),
  c_agg as (
    select
      count(*) filter (where pipeline_stage::text in ('PROSPECCAO','CADENCIA','FECHADO'))::bigint as novos,
      count(*) filter (where pipeline_stage::text = 'REUNIAO_INICIAL')::bigint as interessados,
      count(*) filter (where pipeline_stage::text in
        ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO'))::bigint as em_negociacao,
      count(*) filter (where pipeline_stage::text = 'ATIVO')::bigint as ativos,
      count(*) filter (where pipeline_stage::text in ('PERDIDO','CHURNED'))::bigint as perdidos,
      count(*) filter (where updated_at < now() - interval '15 days'
                         and pipeline_stage::text in
                         ('PROSPECCAO','CADENCIA','FECHADO','REUNIAO_INICIAL','PROPOSTA',
                          'CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO')
                         )::bigint as clients_parados_15d,
      count(*) filter (where next_action_date is null
                         and pipeline_stage::text in
                         ('PROSPECCAO','CADENCIA','FECHADO','REUNIAO_INICIAL','PROPOSTA',
                          'CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO')
                         )::bigint as sem_proxima_acao,
      -- Ganhos/perdidos NA JANELA
      count(*) filter (where pipeline_stage::text = 'ATIVO'
                         and updated_at >= v_from and updated_at < v_to)::bigint as ganhos_periodo,
      count(*) filter (where pipeline_stage::text in ('PERDIDO','CHURNED')
                         and updated_at >= v_from and updated_at < v_to)::bigint as perdidos_periodo,
      coalesce(jsonb_object_agg(pipeline_stage::text, n)
               filter (where pipeline_stage is not null), '{}'::jsonb) as pipeline_json,
      array_remove(array_agg(distinct source_ref)
        filter (where source_ref is not null
                  and pipeline_stage::text in
                  ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA',
                   'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')), null) as advanced_prospects,
      avg(extract(epoch from (updated_at - created_at))/86400.0)
        filter (where pipeline_stage::text = 'ATIVO')::numeric as ciclo_medio_venda_d
    from (
      select id, pipeline_stage, updated_at, created_at, next_action_date, source_ref,
             count(*) over (partition by pipeline_stage) as n
        from c_scope
    ) cs
  ),
  t_agg as (
    select
      count(*) filter (where is_contato)::bigint                                     as contatos_total,
      count(*) filter (where is_contato and enviado_em >= date_trunc('day',now()))::bigint  as contatos_hoje,
      count(*) filter (where is_contato and enviado_em >= date_trunc('week',now()))::bigint as contatos_semana,
      count(*) filter (where is_contato and enviado_em >= date_trunc('month',now()))::bigint as contatos_mes,
      count(*) filter (where is_contato and enviado_em >= v_from and enviado_em < v_to)::bigint as contatos_periodo,
      count(distinct prospect_id) filter (where is_contato)::bigint                  as contatados,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= date_trunc('day',now()))::bigint   as respostas_hoje,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= date_trunc('week',now()))::bigint  as respostas_semana,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= date_trunc('month',now()))::bigint as respostas_mes,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= v_from and enviado_em < v_to)::bigint as respostas_periodo,
      array_remove(array_agg(distinct prospect_id) filter (where is_resposta), null) as resposta_prospects
    from (
      select prospect_id, enviado_em,
        (tipo::text in ('whatsapp','ligacao','email','reuniao')
         and resultado::text <> 'tentativa') as is_contato,
        (tipo::text = 'resposta' or resultado::text in ('respondido','interessado')) as is_resposta
      from t_scope
    ) tt
  ),
  r_agg as (
    select (
      select count(*) from (
        select unnest(coalesce(t.resposta_prospects,'{}'::uuid[]))
        union
        select unnest(coalesce(c.advanced_prospects,'{}'::uuid[]))
      ) u(pid)
    )::bigint as respondidos
    from t_agg t, c_agg c
  ),
  -- KPI: tempo medio ate primeira resposta (dias)
  first_resp as (
    select t.prospect_id,
           min(t.enviado_em) filter (where t.is_outbound) as first_out,
           min(t.enviado_em) filter (where t.is_inbound)  as first_in
      from (
        select prospect_id, enviado_em,
               (tipo::text in ('whatsapp','ligacao','email','reuniao')
                and resultado::text <> 'tentativa') as is_outbound,
               (tipo::text = 'resposta' or resultado::text in ('respondido','interessado')) as is_inbound
          from t_scope
      ) t
     group by t.prospect_id
  ),
  first_resp_agg as (
    select avg(extract(epoch from (first_in - first_out))/86400.0)::numeric as dias
      from first_resp
     where first_in is not null and first_out is not null and first_in >= first_out
  ),
  -- Deals ganhos (period)
  deals_won as (
    select d.*, (d.closed_at - d.created_at) as ciclo
      from public.deals d
      join public.deal_stages ds on ds.id = d.stage_id
      join c_scope c on c.id = d.client_id
     where ds.is_won = true
       and d.closed_at is not null
       and d.closed_at >= v_from and d.closed_at < v_to
  ),
  deals_agg as (
    select count(*)::bigint as won,
           coalesce(sum(value),0)::numeric as receita,
           coalesce(avg(value),0)::numeric as ticket_medio,
           coalesce(avg(extract(epoch from ciclo)/86400.0),0)::numeric as tempo_medio_fechamento_d
      from deals_won
  ),
  -- Evolucao diaria (ultimos 30 dias)
  days as (
    select generate_series(date_trunc('day', now()) - interval '29 days',
                           date_trunc('day', now()),
                           interval '1 day')::date as d
  ),
  evol_dia as (
    select d.d as day,
           coalesce((select count(*) from t_scope t
                      where (t.tipo::text in ('whatsapp','ligacao','email','reuniao')
                             and t.resultado::text <> 'tentativa')
                        and t.enviado_em::date = d.d), 0)::int as contatos,
           coalesce((select count(distinct t.prospect_id) from t_scope t
                      where (t.tipo::text = 'resposta'
                             or t.resultado::text in ('respondido','interessado'))
                        and t.enviado_em::date = d.d), 0)::int as respostas,
           coalesce((select count(*) from c_scope c
                      where c.pipeline_stage::text = 'ATIVO'
                        and c.updated_at::date = d.d), 0)::int as ganhos
      from days d
  ),
  -- Evolucao mensal (ultimos 12 meses)
  months as (
    select generate_series(date_trunc('month', now()) - interval '11 months',
                           date_trunc('month', now()),
                           interval '1 month')::date as m
  ),
  evol_mes as (
    select m.m as month_start,
           coalesce((select count(*) from t_scope t
                      where (t.tipo::text in ('whatsapp','ligacao','email','reuniao')
                             and t.resultado::text <> 'tentativa')
                        and t.enviado_em >= m.m
                        and t.enviado_em <  (m.m + interval '1 month')), 0)::int as contatos,
           coalesce((select count(distinct t.prospect_id) from t_scope t
                      where (t.tipo::text = 'resposta'
                             or t.resultado::text in ('respondido','interessado'))
                        and t.enviado_em >= m.m
                        and t.enviado_em <  (m.m + interval '1 month')), 0)::int as respostas,
           coalesce((select count(*) from c_scope c
                      where c.pipeline_stage::text = 'ATIVO'
                        and c.updated_at >= m.m
                        and c.updated_at <  (m.m + interval '1 month')), 0)::int as ganhos
      from months m
  ),
  -- Ranking por owner_name (top 20)
  ranking as (
    select coalesce(nullif(owner_name,''), '— sem responsavel —') as owner_name,
           count(*) filter (where pipeline_stage::text = 'ATIVO'
                              and updated_at >= v_from and updated_at < v_to)::int as ganhos,
           count(*)::int as base,
           count(*) filter (where pipeline_stage::text in ('PERDIDO','CHURNED')
                              and updated_at >= v_from and updated_at < v_to)::int as perdidos
      from c_scope
     group by 1
     order by ganhos desc, base desc
     limit 20
  ),
  -- Comparacao janela atual x anterior
  prev_t as (
    select count(*)::int filter (where is_contato) as contatos,
           count(distinct prospect_id) filter (where is_resposta) as respostas
    from (
      select prospect_id,
             (tipo::text in ('whatsapp','ligacao','email','reuniao') and resultado::text <> 'tentativa') as is_contato,
             (tipo::text = 'resposta' or resultado::text in ('respondido','interessado')) as is_resposta
      from t_scope
      where enviado_em >= v_prev_from and enviado_em < v_prev_to
    ) x
  ),
  prev_c as (
    select count(*) filter (where pipeline_stage::text = 'ATIVO'
                              and updated_at >= v_prev_from and updated_at < v_prev_to)::int as ganhos,
           count(*) filter (where pipeline_stage::text in ('PERDIDO','CHURNED')
                              and updated_at >= v_prev_from and updated_at < v_prev_to)::int as perdidos
      from c_scope
  ),
  prev_deals as (
    select coalesce(sum(value),0)::numeric as receita
      from public.deals d
      join public.deal_stages ds on ds.id = d.stage_id
      join c_scope c on c.id = d.client_id
     where ds.is_won = true
       and d.closed_at is not null
       and d.closed_at >= v_prev_from and d.closed_at < v_prev_to
  ),
  -- Metas mes corrente
  goal as (
    select meta_receita, meta_clientes, meta_contatos, custo_marketing
      from public.org_goals
     where organization_id = v_org and year = v_year and month = v_month
  )
  select jsonb_build_object(
    'schema','v7',
    'org_id', v_org,
    'janela', jsonb_build_object('from', v_from, 'to', v_to, 'preset', coalesce(v_preset,'mes')),
    'filtros_aplicados', jsonb_build_object('owner_name', v_owner),
    'contatos', jsonb_build_object(
      'hoje', t.contatos_hoje, 'semana', t.contatos_semana, 'mes', t.contatos_mes, 'periodo', t.contatos_periodo
    ),
    'respostas', jsonb_build_object(
      'hoje', t.respostas_hoje, 'semana', t.respostas_semana, 'mes', t.respostas_mes, 'periodo', t.respostas_periodo,
      'taxa', coalesce(round(100.0 * r.respondidos / nullif(t.contatados,0),1),0)
    ),
    'resumo', jsonb_build_object(
      'base', p.base, 'contatados', t.contatados, 'respondidos', r.respondidos,
      'novos', c.novos, 'interessados', c.interessados,
      'em_negociacao', c.em_negociacao, 'ativos', c.ativos, 'perdidos', c.perdidos
    ),
    'pipeline', c.pipeline_json,
    'gargalos', jsonb_build_object(
      'cadencia_atrasada', p.cadencia_atrasada,
      'parados_30d',       p.parados_30d,
      'sem_responsavel',   p.sem_responsavel,
      'clients_parados_15d', c.clients_parados_15d,
      'sem_proxima_acao',    c.sem_proxima_acao
    ),
    'conversao', jsonb_build_object(
      'base_contato',      coalesce(round(100.0 * t.contatados  / nullif(p.base,0),1),0),
      'contato_resposta',  coalesce(round(100.0 * r.respondidos / nullif(t.contatados,0),1),0),
      'resposta_interesse',coalesce(round(100.0 * (c.interessados + c.em_negociacao + c.ativos)
                                          / nullif(r.respondidos,0),1),0),
      'interesse_proposta',coalesce(round(100.0 * (c.em_negociacao + c.ativos)
                                          / nullif(c.interessados + c.em_negociacao + c.ativos,0),1),0),
      'proposta_ativo',    coalesce(round(100.0 * c.ativos
                                          / nullif(c.em_negociacao + c.ativos,0),1),0)
    ),
    'kpis_gerencial', jsonb_build_object(
      'taxa_resposta',                  coalesce(round(100.0 * r.respondidos / nullif(t.contatados,0),1),0),
      'taxa_conversao',                 coalesce(round(100.0 * c.ativos      / nullif(p.base,0),2),0),
      'taxa_fechamento',                coalesce(round(100.0 * c.ativos      / nullif(c.ativos + c.perdidos,0),1),0),
      'ticket_medio',                   coalesce(round(da.ticket_medio,2),0),
      'tempo_medio_fechamento_d',       coalesce(round(da.tempo_medio_fechamento_d,1),0),
      'tempo_medio_primeira_resposta_d',coalesce(round(fr.dias,1),0),
      'ciclo_medio_venda_d',            coalesce(round(c.ciclo_medio_venda_d,1),0),
      'clientes_ganhos',                c.ganhos_periodo,
      'clientes_perdidos',              c.perdidos_periodo,
      'receita_periodo',                da.receita,
      'roi_comercial',                  case when (select custo_marketing from goal) > 0
        then round(100.0 * (da.receita - (select custo_marketing from goal))
                        / (select custo_marketing from goal), 1)
        else null end
    ),
    'series', jsonb_build_object(
      'evolucao_diaria',  (select coalesce(jsonb_agg(jsonb_build_object(
                              'day', day, 'contatos', contatos,
                              'respostas', respostas, 'ganhos', ganhos) order by day), '[]'::jsonb)
                            from evol_dia),
      'evolucao_mensal',  (select coalesce(jsonb_agg(jsonb_build_object(
                              'month', month_start, 'contatos', contatos,
                              'respostas', respostas, 'ganhos', ganhos) order by month_start), '[]'::jsonb)
                            from evol_mes),
      'ranking',          (select coalesce(jsonb_agg(jsonb_build_object(
                              'owner_name', owner_name, 'ganhos', ganhos,
                              'perdidos', perdidos, 'base', base) order by ganhos desc, base desc), '[]'::jsonb)
                            from ranking),
      'funil',            jsonb_build_array(
                            jsonb_build_object('etapa','Base',         'valor', p.base),
                            jsonb_build_object('etapa','Contatados',   'valor', t.contatados),
                            jsonb_build_object('etapa','Responderam',  'valor', r.respondidos),
                            jsonb_build_object('etapa','Interessados', 'valor', c.interessados),
                            jsonb_build_object('etapa','Em negociacao','valor', c.em_negociacao),
                            jsonb_build_object('etapa','Ativos',       'valor', c.ativos)
                          )
    ),
    'comparacao', jsonb_build_object(
      'atual',    jsonb_build_object('contatos', t.contatos_periodo,
                                     'respostas', t.respostas_periodo,
                                     'ganhos', c.ganhos_periodo,
                                     'perdidos', c.perdidos_periodo,
                                     'receita', da.receita),
      'anterior', jsonb_build_object('contatos', (select contatos from prev_t),
                                     'respostas', (select respostas from prev_t),
                                     'ganhos', (select ganhos from prev_c),
                                     'perdidos', (select perdidos from prev_c),
                                     'receita', (select receita from prev_deals))
    ),
    'metas', jsonb_build_object(
      'mes_ano',    jsonb_build_object('year', v_year, 'month', v_month),
      'meta_receita',    coalesce((select meta_receita    from goal), 0),
      'meta_clientes',   coalesce((select meta_clientes   from goal), 0),
      'meta_contatos',   coalesce((select meta_contatos   from goal), 0),
      'custo_marketing', coalesce((select custo_marketing from goal), 0),
      'realizado_receita',  da.receita,
      'realizado_clientes', c.ganhos_periodo,
      'realizado_contatos', t.contatos_mes
    )
  )
  from p_agg p, c_agg c, t_agg t, r_agg r, deals_agg da, first_resp_agg fr
  );
end $func$;
grant execute on function public.dashboard_metrics_v7(jsonb) to authenticated;

-- Wrapper sem args (retrocompat com cliente atual)
drop function if exists public.dashboard_metrics();
create function public.dashboard_metrics()
returns jsonb language sql stable security definer set search_path = public as $$
  select public.dashboard_metrics_v7('{}'::jsonb);
$$;
grant execute on function public.dashboard_metrics() to authenticated;

-- ------------------------------------------------------------
-- 5) Options p/ filtros (vendedores)
-- ------------------------------------------------------------
drop function if exists public.dashboard_filters_options();
create function public.dashboard_filters_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_org uuid;
begin
  if v_uid is null then raise exception 'auth_required' using errcode='28000'; end if;
  select organization_id into v_org from public.user_active_org where user_id = v_uid;
  if v_org is null then raise exception 'no_active_org' using errcode='P0001'; end if;
  if not exists (select 1 from public.organization_members
                  where organization_id = v_org and user_id = v_uid) then
    raise exception 'org_access_denied' using errcode='42501';
  end if;

  return jsonb_build_object(
    'vendedores', coalesce((
      select jsonb_agg(distinct jsonb_build_object('owner_name', owner_name) order by jsonb_build_object('owner_name', owner_name))
        from (
          select owner_name from public.prospects
            where organization_id = v_org and nullif(owner_name,'') is not null
          union
          select owner_name from public.clients
            where organization_id = v_org and nullif(owner_name,'') is not null
        ) s
    ), '[]'::jsonb)
  );
end $$;
grant execute on function public.dashboard_filters_options() to authenticated;

-- ------------------------------------------------------------
-- 6) Metas (upsert)
-- ------------------------------------------------------------
drop function if exists public.upsert_org_goal(int,int,numeric,int,int,numeric);
create function public.upsert_org_goal(
  p_year int, p_month int,
  p_meta_receita numeric, p_meta_clientes int,
  p_meta_contatos int, p_custo_marketing numeric
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_org uuid;
begin
  if v_uid is null then raise exception 'auth_required' using errcode='28000'; end if;
  select organization_id into v_org from public.user_active_org where user_id = v_uid;
  if v_org is null then raise exception 'no_active_org' using errcode='P0001'; end if;
  if not exists (select 1 from public.organization_members
                  where organization_id = v_org and user_id = v_uid) then
    raise exception 'org_access_denied' using errcode='42501';
  end if;

  insert into public.org_goals(organization_id, year, month,
    meta_receita, meta_clientes, meta_contatos, custo_marketing, updated_by, updated_at)
  values (v_org, p_year, p_month,
    coalesce(p_meta_receita,0), coalesce(p_meta_clientes,0),
    coalesce(p_meta_contatos,0), coalesce(p_custo_marketing,0), v_uid, now())
  on conflict (organization_id, year, month) do update
    set meta_receita    = excluded.meta_receita,
        meta_clientes   = excluded.meta_clientes,
        meta_contatos   = excluded.meta_contatos,
        custo_marketing = excluded.custo_marketing,
        updated_by      = excluded.updated_by,
        updated_at      = now();
end $$;
grant execute on function public.upsert_org_goal(int,int,numeric,int,int,numeric) to authenticated;

-- ------------------------------------------------------------
-- 7) Snapshots (job)
-- ------------------------------------------------------------
drop function if exists public.dashboard_save_snapshots_all();
create function public.dashboard_save_snapshots_all()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n_saved int := 0;
  v_payload jsonb;
begin
  for r in
    select o.id, m.user_id
      from public.organizations o
      join lateral (
        select user_id from public.organization_members
         where organization_id = o.id
         order by created_at asc nulls last
         limit 1
      ) m on true
  loop
    -- Executa como o membro mais antigo (so para satisfazer auth.uid() em dashboard_metrics_v7).
    -- Como esta funcao roda em SECURITY DEFINER, fazemos a chamada inline (replica de v7 simplificada)
    -- via SQL direta na tabela snapshots a partir da RPC -- aqui chamamos a RPC com um set local role/jwt.
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.user_id::text, 'role','authenticated')::text, true);
    perform set_config('role','authenticated', true);
    begin
      v_payload := public.dashboard_metrics_v7('{}'::jsonb);
      insert into public.dashboard_snapshots(organization_id, snapshot_date, payload, captured_at)
      values (r.id, current_date, v_payload, now())
      on conflict (organization_id, snapshot_date) do update
        set payload = excluded.payload, captured_at = excluded.captured_at;
      n_saved := n_saved + 1;
    exception when others then
      -- nao deixa uma org quebrada parar o job
      raise warning 'snapshot falhou para org %: %', r.id, sqlerrm;
    end;
    perform set_config('role','postgres', true);
  end loop;
  return n_saved;
end $$;
grant execute on function public.dashboard_save_snapshots_all() to service_role;

-- pg_cron schedule (so se a extension existir)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'dashboard_snapshots_daily';
    perform cron.schedule(
      'dashboard_snapshots_daily',
      '5 0 * * *',
      $cron$ select public.dashboard_save_snapshots_all(); $cron$
    );
  else
    raise notice 'pg_cron nao instalado; rode public.dashboard_save_snapshots_all() manualmente ou agende externamente.';
  end if;
end $$;

notify pgrst, 'reload schema';
commit;