-- ============================================================
-- Onda 2 — Consolidacao e Hardening do Dashboard
-- Estritamente aditiva. Nao altera regras de negocio nem o
-- contrato JSON do dashboard_metrics(). Endurece:
--   1) convert_prospect_to_client (org-scope + advisory lock + idempotente)
--   2) Guard de pipeline_stage (fail-fast quando enum cresce)
--   3) Dedupe das contagens de "respostas" (distinct prospect)
--   4) Padronizacao de "responsavel" via owner_name
--   5) RPC consolidada (1 leitura por tabela; sem CTE redundante)
--   6) Indices revisados (apenas com ganho comprovado)
-- ============================================================

begin;
set local check_function_bodies = off;

-- ------------------------------------------------------------
-- 1) convert_prospect_to_client — escopo por ORG + advisory lock
-- ------------------------------------------------------------
drop function if exists public.convert_prospect_to_client(uuid, numeric, text);
create or replace function public.convert_prospect_to_client(
  p_prospect_id uuid,
  p_deal_value  numeric default 0,
  p_deal_title  text    default null
) returns table (client_id uuid, deal_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_prospect public.prospects;
  v_client   public.clients;
  v_deal     public.deals;
  v_created  boolean := false;
begin
  if v_uid is null then raise exception 'auth_required' using errcode='28000'; end if;

  select organization_id into v_org from public.user_active_org where user_id = v_uid;
  if v_org is null then raise exception 'no_active_org' using errcode='P0001'; end if;

  if not exists (select 1 from public.organization_members
                  where organization_id = v_org and user_id = v_uid) then
    raise exception 'org_access_denied' using errcode='42501';
  end if;

  -- Serializa conversoes simultaneas do MESMO prospect (mesma org)
  perform pg_advisory_xact_lock(
    hashtextextended('convert_prospect:' || p_prospect_id::text, 0)
  );

  -- Trava a linha do prospect (somente desta organizacao)
  select * into v_prospect
    from public.prospects
   where id = p_prospect_id
     and organization_id = v_org
   for update;
  if not found then raise exception 'prospect_not_found' using errcode='P0002'; end if;

  -- Idempotencia: procura cliente existente por prospect_id OU por CNPJ
  -- (escopo de ORG, NUNCA por user_id — todos os vendedores da org
  -- compartilham a base de clientes).
  select * into v_client
    from public.clients
   where organization_id = v_org
     and (
       source_ref  = v_prospect.id
       or prospect_id = v_prospect.id
       or (v_prospect.cnpj is not null and v_prospect.cnpj <> '' and cnpj = v_prospect.cnpj)
     )
   order by created_at asc
   limit 1
   for update;

  if not found then
    insert into public.clients(
      user_id, organization_id, prospect_id, company, cnpj, segment, contact_name,
      whatsapp, phone, email, instagram, city, state, owner_name, notes,
      created_from, source_ref
    ) values (
      v_uid, v_org, v_prospect.id, v_prospect.company, nullif(v_prospect.cnpj,''),
      v_prospect.segment, v_prospect.owner_name,
      v_prospect.whatsapp, v_prospect.phone, v_prospect.email, v_prospect.instagram,
      v_prospect.city, v_prospect.state, v_prospect.owner_name,
      'Convertido do prospect em ' || to_char(now(),'DD/MM/YYYY HH24:MI'),
      'prospect', v_prospect.id
    ) returning * into v_client;
    v_created := true;
  else
    update public.clients set
      prospect_id  = coalesce(prospect_id, v_prospect.id),
      source_ref   = coalesce(source_ref, v_prospect.id),
      created_from = coalesce(created_from, 'prospect'),
      cnpj         = coalesce(nullif(cnpj,''), nullif(v_prospect.cnpj,'')),
      segment      = coalesce(nullif(segment,''), v_prospect.segment),
      contact_name = coalesce(nullif(contact_name,''), v_prospect.owner_name),
      whatsapp     = coalesce(nullif(whatsapp,''), v_prospect.whatsapp),
      phone        = coalesce(nullif(phone,''), v_prospect.phone),
      email        = coalesce(nullif(email,''), v_prospect.email),
      instagram    = coalesce(nullif(instagram,''), v_prospect.instagram),
      city         = coalesce(nullif(city,''), v_prospect.city),
      state        = coalesce(nullif(state,''), v_prospect.state),
      owner_name   = coalesce(nullif(owner_name,''), v_prospect.owner_name)
    where id = v_client.id
    returning * into v_client;
  end if;

  -- Deal aberto (idempotente por client)
  select * into v_deal
    from public.deals
   where client_id = v_client.id and closed_at is null
   order by created_at desc limit 1;
  if not found then
    insert into public.deals(
      user_id, client_id, prospect_id, title, value, stage_id, owner_name
    ) values (
      v_uid, v_client.id, v_prospect.id,
      coalesce(p_deal_title, v_prospect.company),
      coalesce(p_deal_value, 0),
      'lead', v_prospect.owner_name
    ) returning * into v_deal;

    insert into public.deal_activities(user_id, deal_id, kind, text)
    values (v_uid, v_deal.id, 'note',
      'Deal criado a partir do prospect ' || v_prospect.company);
  end if;

  update public.prospects
     set status = 'cliente', updated_at = now()
   where id = v_prospect.id;

  insert into public.prospect_interactions(prospect_id, user_id, kind, text, by_name)
  values (v_prospect.id, v_uid, 'nota',
    case when v_created then 'Convertido em cliente'
         else 'Cliente ja existia — vinculo reforcado' end,
    'Sistema');

  return query select v_client.id, v_deal.id, v_created;
end $$;
grant execute on function public.convert_prospect_to_client(uuid, numeric, text) to authenticated;

-- Unicidade defensiva: 1 prospect -> no maximo 1 cliente por organizacao.
create unique index if not exists clients_org_source_ref_uniq
  on public.clients(organization_id, source_ref)
  where source_ref is not null;

-- ------------------------------------------------------------
-- 2) Guard de pipeline_stage — falha se um novo enum aparecer
--    sem mapeamento explicito no dashboard.
-- ------------------------------------------------------------
create or replace function public.assert_pipeline_stages_mapped()
returns void language plpgsql stable as $$
declare
  v_mapped text[] := ARRAY[
    'PROSPECCAO','CADENCIA','FECHADO',          -- novos
    'REUNIAO_INICIAL',                          -- interessados
    'PROPOSTA','CONTRATO','ASSINATURA',
    'PAGAMENTO_CONFIRMADO','IMPLANTACAO',       -- em_negociacao
    'ATIVO',                                    -- ativos
    'PERDIDO','CHURNED'                         -- perdidos
  ];
  v_missing text;
begin
  select string_agg(label, ', ') into v_missing
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

-- Fail-fast nesta migration: se algum enum nao esta mapeado, aborta.
select public.assert_pipeline_stages_mapped();

-- ------------------------------------------------------------
-- 3+4+5) dashboard_metrics() v6
--   - Mesma resposta JSON do v5 (apenas 'schema' muda para 'v6').
--   - "respostas.{hoje,semana,mes}" agora deduplicam por prospect
--     no periodo (mesma regra de "respondidos").
--   - "responsavel" padronizado em owner_name (unica fonte).
--   - Guard de pipeline_stage executa no inicio.
--   - 1 leitura por tabela; advanced_set absorvido em c_agg via
--     subquery escalar.
-- ------------------------------------------------------------
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
  -- Touchpoints lidos UMA vez. respostas_* deduplicam por prospect no periodo;
  -- "respondidos" usa a mesma regra (uniao com avancos de funil).
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
    -- Mesma regra de "respostas": deduplicado por prospect, unido com avancos.
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