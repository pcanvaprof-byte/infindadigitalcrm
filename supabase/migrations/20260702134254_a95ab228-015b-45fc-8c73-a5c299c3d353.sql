-- ============================================================
-- Parte 1: Unify history touchpoints
-- ============================================================
alter table public.prospect_touchpoints add column if not exists by_name text;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.prospect_touchpoints'::regclass
      and contype = 'c'
      and (conname = 'prospect_touchpoints_tipo_check' or pg_get_constraintdef(oid) ilike '%tipo%')
  loop
    execute format('alter table public.prospect_touchpoints drop constraint if exists %I', r.conname);
  end loop;
  alter table public.prospect_touchpoints
    add constraint prospect_touchpoints_tipo_check
    check (tipo in ('whatsapp','ligacao','email','reuniao','nota','status','resposta'));
end $$;

-- ============================================================
-- Parte 2: Lifecycle enums + colunas em clients
-- ============================================================
do $$ begin
  create type public.pipeline_stage as enum (
    'PROSPECCAO','CADENCIA','FECHADO','REUNIAO_INICIAL','PROPOSTA',
    'CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO',
    'CHURNED','PERDIDO'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_financial_status as enum ('pendente','confirmado','recorrente','inadimplente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_lc_contract_status as enum ('nao_gerado','enviado','assinado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_onboarding_status as enum ('pendente','em_andamento','concluido');
exception when duplicate_object then null; end $$;

alter table public.clients
  add column if not exists pipeline_stage public.pipeline_stage not null default 'PROSPECCAO',
  add column if not exists financial_status public.client_financial_status not null default 'pendente',
  add column if not exists lc_contract_status public.client_lc_contract_status not null default 'nao_gerado',
  add column if not exists onboarding_status public.client_onboarding_status not null default 'pendente',
  add column if not exists current_step text,
  add column if not exists next_action_date timestamptz,
  add column if not exists operations_locked boolean not null default true,
  add column if not exists created_from text,
  add column if not exists source_ref uuid,
  add column if not exists activated_at timestamptz,
  add column if not exists churned_at timestamptz,
  add column if not exists plano_code text,
  add column if not exists mensalidade numeric(12,2),
  add column if not exists contract_value numeric(14,2) not null default 0;

create index if not exists clients_pipeline_idx on public.clients(pipeline_stage);
create index if not exists clients_next_action_idx on public.clients(next_action_date);
create index if not exists idx_clients_contract_value on public.clients(organization_id, contract_value);

-- ============================================================
-- Parte 3: Trigger cadência atualizada (nota/status/resposta não avançam)
-- ============================================================
create or replace function public.advance_prospect_cadence()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  intervals int[] := array[1,3,7,15,21];
  cur_step smallint; nxt_step smallint; nxt_at timestamptz;
  new_resp text; new_cad text;
begin
  if new.tipo in ('nota','status','resposta') then
    if new.tipo = 'resposta' then
      update prospects set response_status = coalesce(nullif(response_status,'sem_resposta'), 'respondeu'),
                           updated_at = now() where id = new.prospect_id;
    end if;
    return new;
  end if;

  select cadence_step into cur_step from prospects where id = new.prospect_id;
  nxt_step := least(coalesce(cur_step,0) + 1, 6);

  if new.resultado = 'sem_interesse' or nxt_step >= 6 then
    nxt_at := null; new_cad := 'encerrado';
  elsif new.resultado = 'interessado' then
    nxt_at := null; new_cad := 'ativo';
  else
    nxt_at := new.enviado_em + (intervals[nxt_step] || ' days')::interval;
    new_cad := 'ativo';
  end if;

  new_resp := case new.resultado
    when 'respondido' then 'respondeu'
    when 'interessado' then 'interessado'
    when 'sem_interesse' then 'sem_interesse'
    else null end;

  update prospects set
    cadence_step = nxt_step, cadence_status = new_cad,
    last_contact_at = new.enviado_em, next_contact_at = nxt_at,
    response_status = coalesce(new_resp, response_status),
    closed_at = case when new_cad = 'encerrado' then now() else closed_at end,
    closed_reason = case when new.resultado = 'sem_interesse' then 'sem_interesse'
                          when nxt_step >= 6 then 'cadencia_concluida'
                          else closed_reason end,
    updated_at = now()
  where id = new.prospect_id;
  return new;
end $$;

-- ============================================================
-- Parte 4: Backfill de prospect_interactions -> touchpoints
-- ============================================================
alter table public.prospect_touchpoints disable trigger prospect_touchpoint_advance;

with default_org as (select id from public.organizations order by created_at limit 1),
src as (
  select i.prospect_id, i.user_id,
    case when i.kind in ('whatsapp','ligacao','email','reuniao','nota','status') then i.kind else 'nota' end as tipo,
    i.text as mensagem,
    'enviado' as resultado,
    i.created_at as enviado_em, i.by_name,
    (select id from default_org) as organization_id
  from public.prospect_interactions i
)
insert into public.prospect_touchpoints
  (prospect_id, user_id, tipo, mensagem, resultado, enviado_em, by_name, organization_id)
select s.prospect_id, s.user_id, s.tipo, s.mensagem, s.resultado, s.enviado_em, s.by_name, s.organization_id
from src s
where s.organization_id is not null
  and not exists (
    select 1 from public.prospect_touchpoints t
    where t.prospect_id = s.prospect_id and t.user_id = s.user_id and t.tipo = s.tipo
      and abs(extract(epoch from (t.enviado_em - s.enviado_em))) < 60
  );

alter table public.prospect_touchpoints enable trigger prospect_touchpoint_advance;

comment on table public.prospect_interactions is
  'LEGADO — substituída por prospect_touchpoints como única fonte de verdade.';

-- ============================================================
-- Parte 5: dashboard_metrics() v2
-- ============================================================
create or replace function public.dashboard_current_org_id()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
  if to_regprocedure('public.current_org_id()') is null then return null; end if;
  execute 'select public.current_org_id()' into v_org;
  return v_org;
exception when others then return null;
end $$;
grant execute on function public.dashboard_current_org_id() to authenticated, anon, service_role;

create or replace function public.dashboard_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return (
  with
  p as (select * from prospects where user_id = auth.uid()),
  t_out as (
    select * from prospect_touchpoints
     where user_id = auth.uid()
       and tipo in ('whatsapp','ligacao','email','reuniao')
       and resultado <> 'tentativa'
  ),
  t_in as (
    select * from prospect_touchpoints
     where user_id = auth.uid()
       and (tipo = 'resposta' or resultado in ('respondido','interessado'))
  ),
  contatados as (select distinct prospect_id from t_out),
  respondidos as (select distinct prospect_id from t_in),
  c as (
    select * from clients
     where user_id = auth.uid() or organization_id = public.dashboard_current_org_id()
  )
  select jsonb_build_object(
    'contatos', jsonb_build_object(
      'hoje', (select count(*) from t_out where enviado_em >= date_trunc('day', now())),
      'semana', (select count(*) from t_out where enviado_em >= date_trunc('week', now())),
      'mes', (select count(*) from t_out where enviado_em >= date_trunc('month', now()))
    ),
    'respostas', jsonb_build_object(
      'hoje', (select count(*) from t_in where enviado_em >= date_trunc('day', now())),
      'semana', (select count(*) from t_in where enviado_em >= date_trunc('week', now())),
      'mes', (select count(*) from t_in where enviado_em >= date_trunc('month', now())),
      'taxa', coalesce(round(100.0 * (select count(*) from respondidos) / nullif((select count(*) from contatados),0), 1), 0)
    ),
    'resumo', jsonb_build_object(
      'base', (select count(*) from p),
      'contatados', (select count(*) from contatados),
      'respondidos', (select count(*) from respondidos),
      'interessados', (select count(*) from c where pipeline_stage in
        ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),
      'em_negociacao', (select count(*) from c where pipeline_stage in
        ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO')),
      'ativos', (select count(*) from c where pipeline_stage = 'ATIVO'),
      'perdidos', (select count(*) from c where pipeline_stage in ('PERDIDO','CHURNED'))
    ),
    'pipeline', (
      select coalesce(jsonb_object_agg(pipeline_stage, n), '{}'::jsonb)
      from (select pipeline_stage::text, count(*) as n from c group by pipeline_stage) s
    ),
    'gargalos', jsonb_build_object(
      'cadencia_atrasada', (select count(*) from p where cadence_status='ativo' and next_contact_at < now()),
      'parados_30d', (select count(*) from p where last_contact_at < now() - interval '30 days'),
      'sem_responsavel', (select count(*) from p where coalesce(nullif(owner_name,''), null) is null),
      'clients_parados_15d', (select count(*) from c where updated_at < now() - interval '15 days'
                                and pipeline_stage not in ('ATIVO','CHURNED','PERDIDO')),
      'sem_proxima_acao', (select count(*) from c where next_action_date is null
                                and pipeline_stage not in ('ATIVO','CHURNED','PERDIDO'))
    ),
    'conversao', jsonb_build_object(
      'base_contato', coalesce(round(100.0 * (select count(*) from contatados) / nullif((select count(*) from p),0), 1), 0),
      'contato_resposta', coalesce(round(100.0 * (select count(*) from respondidos) / nullif((select count(*) from contatados),0), 1), 0),
      'resposta_interesse', coalesce(round(100.0 * (select count(*) from c where pipeline_stage in
          ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO'))
        / nullif((select count(*) from respondidos),0), 1), 0),
      'interesse_proposta', coalesce(round(100.0 * (select count(*) from c where pipeline_stage in
          ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO'))
        / nullif((select count(*) from c where pipeline_stage in
          ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),0), 1), 0),
      'proposta_ativo', coalesce(round(100.0 * (select count(*) from c where pipeline_stage = 'ATIVO')
        / nullif((select count(*) from c where pipeline_stage in
          ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),0), 1), 0)
    )
  ));
end $$;
grant execute on function public.dashboard_metrics() to authenticated;

-- ============================================================
-- Parte 6: Tabelas de apoio (stubs) para BI layer
-- ============================================================
create table if not exists public.op_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  campaign_name text not null,
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.op_campaigns to authenticated;
grant all on public.op_campaigns to service_role;
alter table public.op_campaigns enable row level security;
drop policy if exists op_campaigns_org_rw on public.op_campaigns;
create policy op_campaigns_org_rw on public.op_campaigns for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create table if not exists public.org_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  year int,
  month int,
  meta_receita numeric(14,2) not null default 0,
  custo_marketing numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.org_goals to authenticated;
grant all on public.org_goals to service_role;
alter table public.org_goals enable row level security;
drop policy if exists org_goals_org_rw on public.org_goals;
create policy org_goals_org_rw on public.org_goals for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ============================================================
-- Parte 7: ai_insights
-- ============================================================
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  area text not null check (area in ('comercial','financeiro','marketing','operacoes','diretoria')),
  scope text not null default 'geral',
  payload jsonb not null default '{}'::jsonb,
  summary text not null,
  recommendations jsonb not null default '[]'::jsonb,
  model text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_insights to authenticated;
grant all on public.ai_insights to service_role;
alter table public.ai_insights enable row level security;
drop policy if exists "ai_insights org rw" on public.ai_insights;
create policy "ai_insights org rw" on public.ai_insights for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
create index if not exists ai_insights_org_area_idx on public.ai_insights(organization_id, area, created_at desc);

-- ============================================================
-- Parte 8: BI Layer functions
-- ============================================================
create or replace function public._bi_org() returns uuid
language sql stable security definer set search_path = public as $$
  select public.current_org_id()
$$;

create or replace function public.bi_funnel_bottlenecks()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.tempo_medio_dias desc), '[]'::jsonb) into v_out
  from (
    select coalesce(c.pipeline_stage::text, 'desconhecido') as stage,
      count(*)::int as clientes,
      round(avg(extract(epoch from (now() - c.updated_at)) / 86400)::numeric, 1) as tempo_medio_dias
    from public.clients c where c.organization_id = v_org
    group by 1 having count(*) > 0
  ) t;
  return v_out;
end $$;

create or replace function public.bi_lost_opportunities()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return jsonb_build_object('total',0,'valor_perdido',0,'recentes','[]'::jsonb); end if;
  select jsonb_build_object(
    'total', (select count(*) from public.clients where organization_id = v_org and pipeline_stage::text = 'PERDIDO'),
    'valor_perdido', coalesce((select sum(coalesce(contract_value,0)) from public.clients
              where organization_id = v_org and pipeline_stage::text = 'PERDIDO'), 0),
    'recentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'empresa', company, 'valor', coalesce(contract_value,0), 'updated_at', updated_at
      ) order by updated_at desc)
      from (select id, company, contract_value, updated_at from public.clients
            where organization_id = v_org and pipeline_stage::text = 'PERDIDO'
            order by updated_at desc limit 10) s
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

create or replace function public.bi_clients_perdidos()
returns jsonb language sql stable security definer set search_path = public as $$
  select public.bi_lost_opportunities()
$$;

create or replace function public.bi_revenue_forecast()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org();
  v_pipeline numeric := 0; v_taxa numeric := 0; v_ativos numeric := 0; v_mrr numeric := 0;
  v_total int := 0; v_ganhos int := 0;
begin
  if v_org is null then return jsonb_build_object('previsao_30d',0,'previsao_90d',0,'mrr',0); end if;
  select coalesce(sum(coalesce(contract_value,0)),0) into v_pipeline from public.clients
   where organization_id = v_org and pipeline_stage::text in ('PROPOSTA','CONTRATO','ASSINATURA');
  select coalesce(sum(coalesce(contract_value,0)),0) into v_ativos from public.clients
   where organization_id = v_org and pipeline_stage::text = 'ATIVO';
  select count(*) into v_total from public.clients where organization_id = v_org;
  select count(*) into v_ganhos from public.clients where organization_id = v_org and pipeline_stage::text = 'ATIVO';
  v_taxa := case when v_total > 0 then v_ganhos::numeric / v_total else 0.15 end;
  v_mrr := v_ativos;
  return jsonb_build_object(
    'pipeline_aberto', v_pipeline,
    'taxa_conversao_historica', round(v_taxa * 100, 1),
    'previsao_30d', round(v_pipeline * v_taxa * 0.4, 2),
    'previsao_90d', round(v_pipeline * v_taxa, 2),
    'mrr', round(v_mrr, 2), 'arr', round(v_mrr * 12, 2)
  );
end $$;

create or replace function public.bi_churn_risk()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return jsonb_build_object('alto',0,'medio',0,'baixo',0,'detalhes','[]'::jsonb); end if;
  with base as (
    select c.id, c.company as empresa, coalesce(c.contract_value,0) as valor, c.updated_at,
           extract(epoch from (now() - c.updated_at)) / 86400 as dias_sem_update
      from public.clients c
     where c.organization_id = v_org and c.pipeline_stage::text = 'ATIVO'
  ), scored as (
    select *, case when dias_sem_update > 60 then 'alto'
                   when dias_sem_update > 30 then 'medio'
                   else 'baixo' end as risco from base
  )
  select jsonb_build_object(
    'alto', (select count(*) from scored where risco='alto'),
    'medio', (select count(*) from scored where risco='medio'),
    'baixo', (select count(*) from scored where risco='baixo'),
    'detalhes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,'empresa',empresa,'valor',valor,
        'dias_sem_update', round(dias_sem_update::numeric,0), 'risco', risco
      ) order by dias_sem_update desc)
      from (select * from scored where risco in ('alto','medio') order by dias_sem_update desc limit 20) s
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

create or replace function public.bi_best_contact_hours()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.hora), '[]'::jsonb) into v_out
    from (
      select extract(hour from pt.enviado_em)::int as hora,
             count(*)::int as enviados,
             count(*) filter (where pt.resultado in ('respondido','interessado'))::int as respondidos,
             round(100.0 * count(*) filter (where pt.resultado in ('respondido','interessado'))::numeric
                   / nullif(count(*),0), 1) as taxa_resposta
        from public.prospect_touchpoints pt
        join public.prospects p on p.id = pt.prospect_id
       where p.organization_id = v_org and pt.enviado_em > now() - interval '90 days'
       group by 1
    ) t;
  return v_out;
end $$;

create or replace function public.bi_best_channels()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.taxa_resposta desc nulls last), '[]'::jsonb) into v_out
    from (
      select pt.tipo as canal,
             count(*)::int as enviados,
             count(*) filter (where pt.resultado in ('respondido','interessado'))::int as respondidos,
             round(100.0 * count(*) filter (where pt.resultado in ('respondido','interessado'))::numeric
                   / nullif(count(*),0), 1) as taxa_resposta
        from public.prospect_touchpoints pt
        join public.prospects p on p.id = pt.prospect_id
       where p.organization_id = v_org and pt.enviado_em > now() - interval '90 days'
       group by 1
    ) t;
  return v_out;
end $$;

create or replace function public.bi_top_campaigns()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.receita desc nulls last), '[]'::jsonb) into v_out
    from (
      select k.campaign_name as campanha, k.status,
             count(distinct k.client_id)::int as clientes,
             coalesce(sum(coalesce(c.contract_value,0)),0) as receita
        from public.op_campaigns k
        left join public.clients c on c.id = k.client_id and c.organization_id = v_org
       where k.organization_id = v_org
       group by 1,2 order by receita desc limit 15
    ) t;
  return v_out;
end $$;

create or replace function public.bi_financial_kpis()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org();
  v_clientes_ativos int := 0; v_receita_realizada numeric := 0; v_mrr numeric := 0;
  v_custo numeric := 0; v_ticket numeric := 0; v_cac numeric := 0; v_ltv numeric := 0;
  v_roi numeric := 0; v_payback numeric := 0; v_meta numeric := 0; v_novos_no_mes int := 0;
begin
  if v_org is null then return jsonb_build_object('ltv',0,'cac',0,'roi',0,'payback_meses',0); end if;
  select count(*), coalesce(sum(coalesce(contract_value,0)),0)
    into v_clientes_ativos, v_mrr from public.clients
   where organization_id = v_org and pipeline_stage::text = 'ATIVO';
  v_receita_realizada := v_mrr;
  select count(*) into v_novos_no_mes from public.clients
   where organization_id = v_org and created_at >= date_trunc('month', now());
  select coalesce(custo_marketing,0), coalesce(meta_receita,0)
    into v_custo, v_meta from public.org_goals
   where organization_id = v_org order by year desc nulls last, month desc nulls last limit 1;
  v_ticket := case when v_clientes_ativos > 0 then v_mrr / v_clientes_ativos else 0 end;
  v_cac := case when v_novos_no_mes > 0 then v_custo / v_novos_no_mes else 0 end;
  v_ltv := v_ticket * 12;
  v_roi := case when v_custo > 0 then 100.0 * (v_receita_realizada - v_custo) / v_custo else 0 end;
  v_payback := case when v_ticket > 0 then v_cac / v_ticket else 0 end;
  return jsonb_build_object(
    'clientes_ativos', v_clientes_ativos,
    'ticket_medio', round(v_ticket, 2),
    'mrr', round(v_mrr, 2), 'arr', round(v_mrr * 12, 2),
    'receita_realizada', round(v_receita_realizada, 2),
    'receita_prevista_mes', round(v_meta, 2),
    'custo_marketing', round(v_custo, 2),
    'cac', round(v_cac, 2), 'ltv', round(v_ltv, 2),
    'roi', round(v_roi, 1), 'payback_meses', round(v_payback, 1)
  );
end $$;

create or replace function public.bi_dashboard(p_area text default 'diretoria')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '{}'::jsonb;
begin
  case p_area
    when 'comercial' then
      v_out := jsonb_build_object(
        'funnel', public.bi_funnel_bottlenecks(),
        'lost', public.bi_lost_opportunities(),
        'best_hours', public.bi_best_contact_hours(),
        'best_channels', public.bi_best_channels(),
        'forecast', public.bi_revenue_forecast()
      );
    when 'financeiro' then
      v_out := jsonb_build_object(
        'kpis', public.bi_financial_kpis(),
        'forecast', public.bi_revenue_forecast(),
        'lost', public.bi_lost_opportunities()
      );
    when 'marketing' then
      v_out := jsonb_build_object(
        'top_campaigns', public.bi_top_campaigns(),
        'best_hours', public.bi_best_contact_hours(),
        'best_channels', public.bi_best_channels(),
        'kpis', public.bi_financial_kpis()
      );
    when 'operacoes' then
      v_out := jsonb_build_object(
        'churn', public.bi_churn_risk(),
        'top_campaigns', public.bi_top_campaigns(),
        'funnel', public.bi_funnel_bottlenecks()
      );
    else
      v_out := jsonb_build_object(
        'kpis', public.bi_financial_kpis(),
        'forecast', public.bi_revenue_forecast(),
        'funnel', public.bi_funnel_bottlenecks(),
        'churn', public.bi_churn_risk(),
        'lost', public.bi_lost_opportunities(),
        'top_campaigns', public.bi_top_campaigns()
      );
  end case;
  return v_out;
end $$;

grant execute on function public.bi_funnel_bottlenecks(),
                         public.bi_lost_opportunities(),
                         public.bi_clients_perdidos(),
                         public.bi_revenue_forecast(),
                         public.bi_churn_risk(),
                         public.bi_best_contact_hours(),
                         public.bi_best_channels(),
                         public.bi_top_campaigns(),
                         public.bi_financial_kpis(),
                         public.bi_dashboard(text)
  to authenticated;

notify pgrst, 'reload schema';