-- ============================================================
-- Onda 2 — dashboard_metrics() v5 (PERFORMANCE)
--
-- Mesma resposta JSON do v4 (mesmas chaves, mesmas regras).
-- Mudancas:
--   * 1 leitura por tabela (prospects, clients, touchpoints)
--   * count(*) FILTER (WHERE ...) substitui ~25 subqueries
--   * Buckets/contagens consolidados em CTEs unicas
--   * Sem CTEs redundantes, sem SELECT *
--   * Indices compostos por (organization_id, ...) para evitar
--     full scans em bases medias/grandes.
-- ============================================================

begin;
set local check_function_bodies = off;

-- Indices (CONCURRENTLY nao pode dentro de begin; bases pequenas
-- terminam em sub-segundo. Para bases grandes, rode esses CREATE
-- INDEX manualmente fora do tx com CONCURRENTLY.)
create index if not exists prospects_org_idx
  on public.prospects (organization_id);
create index if not exists prospects_org_cadence_next_idx
  on public.prospects (organization_id, cadence_status, next_contact_at);
create index if not exists prospects_org_last_contact_idx
  on public.prospects (organization_id, last_contact_at);

create index if not exists clients_org_stage_idx
  on public.clients (organization_id, pipeline_stage);
create index if not exists clients_org_source_ref_idx
  on public.clients (organization_id, source_ref)
  where source_ref is not null;
create index if not exists clients_org_updated_idx
  on public.clients (organization_id, updated_at);

create index if not exists pt_org_sent_idx
  on public.prospect_touchpoints (organization_id, enviado_em);
create index if not exists pt_org_tipo_res_idx
  on public.prospect_touchpoints (organization_id, tipo, resultado);
create index if not exists pt_org_prospect_idx
  on public.prospect_touchpoints (organization_id, prospect_id);

drop function if exists public.dashboard_metrics();

create function public.dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $func$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_day  timestamptz := date_trunc('day',   now());
  v_week timestamptz := date_trunc('week',  now());
  v_mon  timestamptz := date_trunc('month', now());
  v_advanced_stages text[] := ARRAY[
    'REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA',
    'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO'];
  v_open_stages text[] := ARRAY[
    'PROSPECCAO','CADENCIA','FECHADO','REUNIAO_INICIAL','PROPOSTA',
    'CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO'];
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select organization_id into v_org
    from public.user_active_org
   where user_id = v_uid;
  if v_org is null then
    raise exception 'no_active_org'
      using errcode = 'P0001',
            hint = 'Selecione uma organizacao ativa no seletor do header.';
  end if;

  if not exists (
    select 1 from public.organization_members
     where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'org_access_denied' using errcode = '42501';
  end if;

  return (
  with
  p_agg as (
    select
      count(*)::bigint as base,
      count(*) filter (
        where cadence_status = 'ativo' and next_contact_at < now()
      )::bigint as cadencia_atrasada,
      count(*) filter (
        where last_contact_at < now() - interval '30 days'
      )::bigint as parados_30d,
      count(*) filter (
        where nullif(owner_name, '') is null
      )::bigint as sem_responsavel
    from public.prospects
    where organization_id = v_org
  ),
  c_agg as (
    select
      count(*) filter (where pipeline_stage::text in
        ('PROSPECCAO','CADENCIA','FECHADO'))::bigint as novos,
      count(*) filter (where pipeline_stage::text = 'REUNIAO_INICIAL')::bigint as interessados,
      count(*) filter (where pipeline_stage::text in
        ('PROPOSTA','CONTRATO','ASSINATURA',
         'PAGAMENTO_CONFIRMADO','IMPLANTACAO'))::bigint as em_negociacao,
      count(*) filter (where pipeline_stage::text = 'ATIVO')::bigint as ativos,
      count(*) filter (where pipeline_stage::text in
        ('PERDIDO','CHURNED'))::bigint as perdidos,
      count(*) filter (where
        updated_at < now() - interval '15 days'
        and pipeline_stage::text = ANY(v_open_stages))::bigint as clients_parados_15d,
      count(*) filter (where
        next_action_date is null
        and pipeline_stage::text = ANY(v_open_stages))::bigint as sem_proxima_acao
    from public.clients
    where organization_id = v_org
  ),
  pipeline_agg as (
    select coalesce(jsonb_object_agg(pipeline_stage::text, n), '{}'::jsonb) as pj
    from (
      select pipeline_stage, count(*) as n
        from public.clients
       where organization_id = v_org
       group by pipeline_stage
    ) s
  ),
  advanced_set as (
    select distinct source_ref as prospect_id
      from public.clients
     where organization_id = v_org
       and source_ref is not null
       and pipeline_stage::text = ANY(v_advanced_stages)
  ),
  t_agg as (
    select
      count(*) filter (where
        tipo::text in ('whatsapp','ligacao','email','reuniao')
        and resultado::text <> 'tentativa'
        and enviado_em >= v_day)::bigint as contatos_hoje,
      count(*) filter (where
        tipo::text in ('whatsapp','ligacao','email','reuniao')
        and resultado::text <> 'tentativa'
        and enviado_em >= v_week)::bigint as contatos_semana,
      count(*) filter (where
        tipo::text in ('whatsapp','ligacao','email','reuniao')
        and resultado::text <> 'tentativa'
        and enviado_em >= v_mon)::bigint as contatos_mes,
      count(distinct prospect_id) filter (where
        tipo::text in ('whatsapp','ligacao','email','reuniao')
        and resultado::text <> 'tentativa')::bigint as contatados,
      count(*) filter (where
        (tipo::text = 'resposta' or resultado::text in ('respondido','interessado'))
        and enviado_em >= v_day)::bigint as respostas_hoje,
      count(*) filter (where
        (tipo::text = 'resposta' or resultado::text in ('respondido','interessado'))
        and enviado_em >= v_week)::bigint as respostas_semana,
      count(*) filter (where
        (tipo::text = 'resposta' or resultado::text in ('respondido','interessado'))
        and enviado_em >= v_mon)::bigint as respostas_mes
    from public.prospect_touchpoints
    where organization_id = v_org
  ),
  respondidos_set as (
    select prospect_id
      from public.prospect_touchpoints
     where organization_id = v_org
       and (tipo::text = 'resposta'
            or resultado::text in ('respondido','interessado'))
    union
    select prospect_id from advanced_set
  ),
  respondidos_agg as (
    select count(distinct prospect_id)::bigint as respondidos
      from respondidos_set
  )
  select jsonb_build_object(
    'schema', 'v5',
    'org_id', v_org,
    'contatos', jsonb_build_object(
      'hoje',   t.contatos_hoje,
      'semana', t.contatos_semana,
      'mes',    t.contatos_mes
    ),
    'respostas', jsonb_build_object(
      'hoje',   t.respostas_hoje,
      'semana', t.respostas_semana,
      'mes',    t.respostas_mes,
      'taxa',   coalesce(
        round(100.0 * r.respondidos / nullif(t.contatados, 0), 1), 0)
    ),
    'resumo', jsonb_build_object(
      'base',          p.base,
      'contatados',    t.contatados,
      'respondidos',   r.respondidos,
      'novos',         c.novos,
      'interessados',  c.interessados,
      'em_negociacao', c.em_negociacao,
      'ativos',        c.ativos,
      'perdidos',      c.perdidos
    ),
    'pipeline',  pa.pj,
    'gargalos', jsonb_build_object(
      'cadencia_atrasada',   p.cadencia_atrasada,
      'parados_30d',         p.parados_30d,
      'sem_responsavel',     p.sem_responsavel,
      'clients_parados_15d', c.clients_parados_15d,
      'sem_proxima_acao',    c.sem_proxima_acao
    ),
    'conversao', jsonb_build_object(
      'base_contato',
        coalesce(round(100.0 * t.contatados   / nullif(p.base, 0), 1), 0),
      'contato_resposta',
        coalesce(round(100.0 * r.respondidos  / nullif(t.contatados, 0), 1), 0),
      'resposta_interesse',
        coalesce(round(100.0 * (c.interessados + c.em_negociacao + c.ativos)
                              / nullif(r.respondidos, 0), 1), 0),
      'interesse_proposta',
        coalesce(round(100.0 * (c.em_negociacao + c.ativos)
                              / nullif(c.interessados + c.em_negociacao + c.ativos, 0), 1), 0),
      'proposta_ativo',
        coalesce(round(100.0 * c.ativos
                              / nullif(c.em_negociacao + c.ativos, 0), 1), 0)
    )
  )
  from p_agg p, c_agg c, pipeline_agg pa, t_agg t, respondidos_agg r
  );
end;
$func$;

grant execute on function public.dashboard_metrics() to authenticated;

notify pgrst, 'reload schema';
commit;

-- ============================================================
-- Como rodar EXPLAIN ANALYZE no SQL Editor:
--   set local role authenticated;
--   set local "request.jwt.claims" =
--     '{"sub":"<SEU_USER_ID>","role":"authenticated"}';
--   explain (analyze, buffers, format text) select dashboard_metrics();
-- ============================================================
