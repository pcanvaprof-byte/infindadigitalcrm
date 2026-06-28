-- ============================================================
-- Hotfix — Dashboard operacional v6 sem zerar
-- Contexto: algumas bases ficaram com dashboard_metrics() apontando
-- para public.assert_pipeline_stages_mapped(), mas a função auxiliar
-- não existe no schema cache/banco. Resultado: RPC 42883 e painel zerado.
--
-- Esta migration NÃO remove tabelas, NÃO reseta dados e NÃO reativa v7/v8/BI.
-- Ela apenas restaura dashboard_metrics() estável (v6) e recria o guard.
-- ============================================================

begin;
set local check_function_bodies = off;

create or replace function public.assert_pipeline_stages_mapped()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mapped text[] := ARRAY[
    'PROSPECCAO','CADENCIA','FECHADO',
    'REUNIAO_INICIAL',
    'PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO',
    'ATIVO',
    'PERDIDO','CHURNED'
  ];
  v_missing text;
begin
  select string_agg(label, ', ')
    into v_missing
  from (
    select unnest(enum_range(null::public.pipeline_stage))::text as label
  ) e
  where label <> all (v_mapped);

  if v_missing is not null then
    raise exception
      'pipeline_stage sem bucket no dashboard: % — atualize dashboard_metrics() e assert_pipeline_stages_mapped()',
      v_missing
      using errcode = 'P0001';
  end if;
end $$;

grant execute on function public.assert_pipeline_stages_mapped() to authenticated;

create or replace function public.dashboard_metrics()
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
  if v_uid is null then raise exception 'auth_required' using errcode='28000'; end if;

  select organization_id into v_org
    from public.user_active_org
   where user_id = v_uid;

  if v_org is null then
    raise exception 'no_active_org' using errcode='P0001',
      hint='Selecione uma organizacao ativa no seletor do header.';
  end if;

  if not exists (
    select 1 from public.organization_members
     where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'org_access_denied' using errcode='42501';
  end if;

  perform public.assert_pipeline_stages_mapped();

  return (
  with
  p_agg as (
    select
      count(*)::bigint as base,
      count(*) filter (where cadence_status = 'ativo' and next_contact_at < now())::bigint as cadencia_atrasada,
      count(*) filter (where last_contact_at < now() - interval '30 days')::bigint as parados_30d,
      count(*) filter (where nullif(owner_name, '') is null)::bigint as sem_responsavel
    from public.prospects
    where organization_id = v_org
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
                         and pipeline_stage::text = ANY(v_open_stages))::bigint as clients_parados_15d,
      count(*) filter (where next_action_date is null
                         and pipeline_stage::text = ANY(v_open_stages))::bigint as sem_proxima_acao,
      coalesce(jsonb_object_agg(pipeline_stage::text, n) filter (where pipeline_stage is not null), '{}'::jsonb) as pipeline_json,
      array_remove(array_agg(distinct source_ref)
        filter (where source_ref is not null
                  and pipeline_stage::text = ANY(v_advanced_stages)), null) as advanced_prospects
    from (
      select id, pipeline_stage, updated_at, next_action_date, source_ref,
             count(*) over (partition by pipeline_stage) as n
        from public.clients
       where organization_id = v_org
    ) cs
  ),
  t_agg as (
    select
      count(*) filter (where is_contato and enviado_em >= v_day)::bigint   as contatos_hoje,
      count(*) filter (where is_contato and enviado_em >= v_week)::bigint  as contatos_semana,
      count(*) filter (where is_contato and enviado_em >= v_mon)::bigint   as contatos_mes,
      count(distinct prospect_id) filter (where is_contato)::bigint        as contatados,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= v_day)::bigint   as respostas_hoje,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= v_week)::bigint  as respostas_semana,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= v_mon)::bigint   as respostas_mes,
      array_remove(array_agg(distinct prospect_id) filter (where is_resposta), null) as resposta_prospects
    from (
      select
        prospect_id, enviado_em,
        (tipo::text in ('whatsapp','ligacao','email','reuniao')
         and resultado::text <> 'tentativa') as is_contato,
        (tipo::text = 'resposta' or resultado::text in ('respondido','interessado')) as is_resposta
      from public.prospect_touchpoints
      where organization_id = v_org
    ) tt
  ),
  r_agg as (
    select (
      select count(*) from (
        select unnest(coalesce(t.resposta_prospects, '{}'::uuid[]))
        union
        select unnest(coalesce(c.advanced_prospects, '{}'::uuid[]))
      ) u(prospect_id)
    )::bigint as respondidos
    from t_agg t, c_agg c
  )
  select jsonb_build_object(
    'schema', 'v6',
    'org_id', v_org,
    'contatos', jsonb_build_object(
      'hoje', t.contatos_hoje, 'semana', t.contatos_semana, 'mes', t.contatos_mes
    ),
    'respostas', jsonb_build_object(
      'hoje', t.respostas_hoje, 'semana', t.respostas_semana, 'mes', t.respostas_mes,
      'taxa', coalesce(round(100.0 * r.respondidos / nullif(t.contatados, 0), 1), 0)
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
      'base_contato',      coalesce(round(100.0 * t.contatados  / nullif(p.base, 0), 1), 0),
      'contato_resposta',  coalesce(round(100.0 * r.respondidos / nullif(t.contatados, 0), 1), 0),
      'resposta_interesse',coalesce(round(100.0 * (c.interessados + c.em_negociacao + c.ativos)
                                          / nullif(r.respondidos, 0), 1), 0),
      'interesse_proposta',coalesce(round(100.0 * (c.em_negociacao + c.ativos)
                                          / nullif(c.interessados + c.em_negociacao + c.ativos, 0), 1), 0),
      'proposta_ativo',    coalesce(round(100.0 * c.ativos
                                          / nullif(c.em_negociacao + c.ativos, 0), 1), 0)
    )
  )
  from p_agg p, c_agg c, t_agg t, r_agg r
  );
end;
$func$;

grant execute on function public.dashboard_metrics() to authenticated;

notify pgrst, 'reload schema';
commit;