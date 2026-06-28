-- ============================================================
-- Dashboard v6.1 — Corrige zeros falsos / Auditoria do dashboard
-- (1) Backfill clients.organization_id via source_ref -> prospects
-- (2) cad_register_response também grava em prospect_touchpoints
--     (mesmo unificado que dashboard_metrics consome)
-- (3) dashboard_metrics v6.1:
--     - bucket "Hoje" em timezone America/Sao_Paulo (não UTC)
--     - bucket "ultimos_7d" rolante (para projeção mensal real)
--     - bucket "Novos" cai em prospects quando clients estiver vazio
-- ============================================================
begin;
set local check_function_bodies = off;

-- (1) Backfill ----------------------------------------------------------------
update public.clients c
   set organization_id = p.organization_id
  from public.prospects p
 where c.organization_id is null
   and c.source_ref is not null
   and p.id::text = c.source_ref
   and p.organization_id is not null;

-- (2) cad_register_response cria touchpoint inbound também -------------------
create or replace function public.cad_register_response(
  p_lead uuid,
  p_mensagem text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead public.cad_leads%rowtype; v_id uuid; v_uid uuid;
begin
  select * into v_lead from public.cad_leads where id = p_lead;
  if not found then raise exception 'lead não encontrado'; end if;

  v_uid := coalesce(auth.uid(), v_lead.owner_id);

  insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
  values (p_lead, v_lead.organization_id, 'whatsapp', 'in', v_lead.stage, p_mensagem, 'respondida')
  returning id into v_id;

  update public.cad_leads
     set last_response_at = now(),
         temperatura = 'quente'
   where id = p_lead;

  -- espelha em prospect_touchpoints para o dashboard contar como resposta
  if v_lead.prospect_id is not null then
    begin
      insert into public.prospect_touchpoints (prospect_id, user_id, tipo, mensagem, resultado)
      values (v_lead.prospect_id, v_uid, 'resposta', p_mensagem, 'respondido');
    exception when others then
      raise notice 'cad_register_response: touchpoint mirror falhou: %', sqlerrm;
    end;
  end if;

  return v_id;
end $$;
grant execute on function public.cad_register_response(uuid, text) to authenticated;

-- (3) dashboard_metrics v6.1 --------------------------------------------------
create or replace function public.dashboard_metrics()
returns jsonb
language plpgsql stable security definer set search_path = public
as $func$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_tz  text := 'America/Sao_Paulo';
  v_day  timestamptz := date_trunc('day',   (now() at time zone v_tz)) at time zone v_tz;
  v_week timestamptz := date_trunc('week',  (now() at time zone v_tz)) at time zone v_tz;
  v_mon  timestamptz := date_trunc('month', (now() at time zone v_tz)) at time zone v_tz;
  v_7d   timestamptz := now() - interval '7 days';
  v_advanced_stages text[] := ARRAY[
    'REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA',
    'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO'];
  v_open_stages text[] := ARRAY[
    'PROSPECCAO','CADENCIA','FECHADO','REUNIAO_INICIAL','PROPOSTA',
    'CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO'];
begin
  if v_uid is null then raise exception 'auth_required' using errcode='28000'; end if;

  select organization_id into v_org from public.user_active_org where user_id = v_uid;
  if v_org is null then
    raise exception 'no_active_org' using errcode='P0001',
      hint='Selecione uma organizacao ativa no seletor do header.';
  end if;
  if not exists (
    select 1 from public.organization_members
     where organization_id = v_org and user_id = v_uid
  ) then raise exception 'org_access_denied' using errcode='42501'; end if;

  perform public.assert_pipeline_stages_mapped();

  return (
  with
  p_agg as (
    select
      count(*)::bigint as base,
      count(*) filter (where cadence_status = 'ativo' and next_contact_at < now())::bigint as cadencia_atrasada,
      count(*) filter (where last_contact_at < now() - interval '30 days')::bigint as parados_30d,
      count(*) filter (where nullif(owner_name, '') is null)::bigint as sem_responsavel,
      count(*) filter (where coalesce(status::text,'') in ('','novo','nao_contatado','primeiro_contato'))::bigint as novos_prospects
    from public.prospects where organization_id = v_org
  ),
  c_agg as (
    select
      count(*) filter (where pipeline_stage::text in ('PROSPECCAO','CADENCIA','FECHADO'))::bigint as novos_clients,
      count(*) filter (where pipeline_stage::text = 'REUNIAO_INICIAL')::bigint as interessados,
      count(*) filter (where pipeline_stage::text in
        ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO'))::bigint as em_negociacao,
      count(*) filter (where pipeline_stage::text = 'ATIVO')::bigint as ativos,
      count(*) filter (where pipeline_stage::text in ('PERDIDO','CHURNED'))::bigint as perdidos,
      count(*) filter (where updated_at < now() - interval '15 days'
                         and pipeline_stage::text = ANY(v_open_stages))::bigint as clients_parados_15d,
      count(*) filter (where next_action_date is null
                         and pipeline_stage::text = ANY(v_open_stages))::bigint as sem_proxima_acao,
      coalesce(jsonb_object_agg(pipeline_stage::text, n)
        filter (where pipeline_stage is not null), '{}'::jsonb) as pipeline_json,
      array_remove(array_agg(distinct source_ref)
        filter (where source_ref is not null
                  and pipeline_stage::text = ANY(v_advanced_stages)), null) as advanced_prospects_text
    from (
      select id, pipeline_stage, updated_at, next_action_date, source_ref,
             count(*) over (partition by pipeline_stage) as n
        from public.clients where organization_id = v_org
    ) cs
  ),
  t_agg as (
    select
      count(*) filter (where is_contato and enviado_em >= v_day)::bigint   as contatos_hoje,
      count(*) filter (where is_contato and enviado_em >= v_week)::bigint  as contatos_semana,
      count(*) filter (where is_contato and enviado_em >= v_mon)::bigint   as contatos_mes,
      count(*) filter (where is_contato and enviado_em >= v_7d)::bigint    as contatos_7d,
      count(distinct prospect_id) filter (where is_contato)::bigint        as contatados,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= v_day)::bigint   as respostas_hoje,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= v_week)::bigint  as respostas_semana,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= v_mon)::bigint   as respostas_mes,
      count(distinct prospect_id) filter (where is_resposta and enviado_em >= v_7d)::bigint    as respostas_7d,
      array_remove(array_agg(distinct prospect_id) filter (where is_resposta), null) as resposta_prospects
    from (
      select prospect_id, enviado_em,
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
        select (av)::uuid from unnest(coalesce(c.advanced_prospects_text, '{}'::text[])) av
         where av ~ '^[0-9a-f-]{36}$'
      ) u(prospect_id)
    )::bigint as respondidos
    from t_agg t, c_agg c
  )
  select jsonb_build_object(
    'schema', 'v6',
    'org_id', v_org,
    'contatos', jsonb_build_object(
      'hoje', t.contatos_hoje, 'semana', t.contatos_semana,
      'mes', t.contatos_mes, 'ultimos_7d', t.contatos_7d
    ),
    'respostas', jsonb_build_object(
      'hoje', t.respostas_hoje, 'semana', t.respostas_semana,
      'mes', t.respostas_mes, 'ultimos_7d', t.respostas_7d,
      'taxa', coalesce(round(100.0 * r.respondidos / nullif(t.contatados, 0), 1), 0)
    ),
    'resumo', jsonb_build_object(
      'base', p.base, 'contatados', t.contatados, 'respondidos', r.respondidos,
      'novos', greatest(c.novos_clients, p.novos_prospects),
      'interessados', c.interessados,
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
      'base_contato',       coalesce(round(100.0 * t.contatados  / nullif(p.base, 0), 1), 0),
      'contato_resposta',   coalesce(round(100.0 * r.respondidos / nullif(t.contatados, 0), 1), 0),
      'resposta_interesse', coalesce(round(100.0 * (c.interessados + c.em_negociacao + c.ativos)
                                            / nullif(r.respondidos, 0), 1), 0),
      'interesse_proposta', coalesce(round(100.0 * (c.em_negociacao + c.ativos)
                                            / nullif(c.interessados + c.em_negociacao + c.ativos, 0), 1), 0),
      'proposta_ativo',     coalesce(round(100.0 * c.ativos
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
