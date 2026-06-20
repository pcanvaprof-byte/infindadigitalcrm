-- ============================================================
-- INFINDA — QA A Remediation (5 critical fixes)
-- 1) numeração de proposta race-safe (pg_advisory_xact_lock)
-- 2) RPCs legadas usando log_evt + prefixo evt_*
-- 3) submit_proposal_decision: guard atômico (validade/status/idempotência)
-- 4) versão ativa atômica em create_proposal_version + decisão usa versão real
-- 5) (sem SQL aqui — extensão do lint é feita em scripts/lint-ebd.mjs)
-- ============================================================

-- ------------------------------------------------------------
-- 1) RACE-SAFE proposals_set_numero
--    Antes: SELECT count(*)+1 → duas inserções concorrentes do mesmo
--    user_id/ano colidiam na unique constraint (erro 23505).
--    Agora: pg_advisory_xact_lock por (user_id, ano) serializa só a
--    geração do número, sem bloquear inserções de outros vendedores.
-- ------------------------------------------------------------
create or replace function public.proposals_set_numero()
returns trigger language plpgsql as $$
declare
  v_year   text := to_char(now(),'YYYY');
  v_count  int;
  v_lockkey bigint;
begin
  if new.numero is null or new.numero = '' then
    -- chave de lock = hash estável por (user_id, ano).
    -- pg_advisory_xact_lock libera no commit/rollback automaticamente.
    v_lockkey := hashtextextended(new.user_id::text || ':' || v_year, 0);
    perform pg_advisory_xact_lock(v_lockkey);

    select count(*) + 1 into v_count
      from public.proposals
     where user_id = new.user_id
       and to_char(created_at,'YYYY') = v_year;

    new.numero := 'PROP-' || v_year || '-' || lpad(v_count::text, 4, '0');
  end if;

  if new.valid_until is null and new.validade_dias is not null then
    new.valid_until := now() + (new.validade_dias || ' days')::interval;
  end if;

  return new;
end $$;

-- ------------------------------------------------------------
-- 2) RPCs legadas: inserts diretos com prefixos não-evt_*
--    quebram a CHECK constraint adicionada em 20260630.
--    Reescrevemos cada uma usando public.log_evt(...).
-- ------------------------------------------------------------

-- 2.1 create_proposal_from_source → evt_proposal_created
create or replace function public.create_proposal_from_source(
  p_deal_id uuid default null,
  p_prospect_id uuid default null,
  p_titulo text default 'Proposta Comercial'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_deal public.deals%rowtype;
  v_client uuid;
  v_prop uuid;
  v_version uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  if p_deal_id is not null then
    select * into v_deal from public.deals where id = p_deal_id and user_id = v_user;
    if not found then raise exception 'deal não encontrado'; end if;
    v_client := v_deal.client_id;
  end if;

  insert into public.proposals(user_id, deal_id, client_id, lead_id, titulo)
  values (v_user, p_deal_id, v_client, p_prospect_id, coalesce(p_titulo,'Proposta Comercial'))
  returning id into v_prop;

  insert into public.proposal_versions(
    proposal_id, version_number, conteudo_json, created_by, is_active
  ) values (v_prop, 1, '{}'::jsonb, v_user, true)
  returning id into v_version;

  update public.proposals set current_version_id = v_version where id = v_prop;

  perform public.log_evt(
    v_prop, 'evt_proposal_created',
    jsonb_build_object('deal_id', p_deal_id, 'prospect_id', p_prospect_id),
    'user'
  );

  return v_prop;
end $$;

-- 2.2 create_proposal_version → evt_version_created + ativação atômica
create or replace function public.create_proposal_version(
  p_proposal_id uuid,
  p_conteudo jsonb,
  p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_next int;
  v_id uuid;
  v_p public.proposals%rowtype;
begin
  -- lock pessimista da proposta — evita 2 versões nascendo "ativas" em paralelo
  select * into v_p from public.proposals
    where id = p_proposal_id and user_id = v_user
    for update;
  if not found then raise exception 'proposta não encontrada'; end if;

  select coalesce(max(version_number),0)+1 into v_next
    from public.proposal_versions where proposal_id = p_proposal_id;

  -- desativa todas as versões anteriores (unique partial index permite só uma ativa)
  update public.proposal_versions
     set is_active = false
   where proposal_id = p_proposal_id and is_active;

  insert into public.proposal_versions(
    proposal_id, version_number, conteudo_json,
    valor_implantacao, valor_mensal, valor_avulso,
    observacoes, created_by, is_active
  ) values (
    p_proposal_id, v_next, coalesce(p_conteudo,'{}'::jsonb),
    v_p.valor_implantacao, v_p.valor_mensal, v_p.valor_avulso,
    p_observacoes, v_user, true
  ) returning id into v_id;

  update public.proposals
     set current_version_id = v_id, updated_at = now()
   where id = p_proposal_id;

  perform public.log_evt(
    p_proposal_id, 'evt_version_created',
    jsonb_build_object('version_number', v_next, 'version_id', v_id),
    'user'
  );

  return v_id;
end $$;

-- 2.3 register_proposal_send → evt_proposal_sent
create or replace function public.register_proposal_send(
  p_proposal_id uuid,
  p_canal text,
  p_destino text default null,
  p_mensagem text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if not exists(select 1 from public.proposals where id = p_proposal_id and user_id = v_user) then
    raise exception 'proposta não encontrada';
  end if;

  insert into public.proposal_sends(proposal_id, canal, destino, mensagem, enviado_por)
  values (p_proposal_id, p_canal::public.proposal_send_channel, p_destino, p_mensagem, v_user);

  update public.proposals
     set status = case when status = 'rascunho' then 'enviada'::public.proposal_status else status end,
         sent_at = coalesce(sent_at, now())
   where id = p_proposal_id;

  perform public.log_evt(
    p_proposal_id, 'evt_proposal_sent',
    jsonb_build_object('canal', p_canal, 'destino', p_destino),
    'user'
  );
end $$;

-- 2.4 register_proposal_view → evt_proposal_viewed
--     (continua existindo para compat; recomenda-se migrar callers
--      para register_proposal_view_safe que tem anti-replay)
create or replace function public.register_proposal_view(
  p_token text, p_ua text default null, p_referrer text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_prop uuid; v_ver uuid;
begin
  select id, current_version_id into v_prop, v_ver
    from public.proposals where token_publico = p_token;
  if v_prop is null then return; end if;

  insert into public.proposal_views(proposal_id, version_id, user_agent, referrer)
  values (v_prop, v_ver, p_ua, p_referrer);

  update public.proposals
     set first_viewed_at = coalesce(first_viewed_at, now()),
         status = case
           when status in ('enviada') then 'visualizada'::public.proposal_status
           else status end
   where id = v_prop;

  perform public.log_evt(
    v_prop, 'evt_proposal_viewed',
    jsonb_build_object('ua', p_ua, 'referrer', p_referrer),
    'client'
  );
end $$;

-- 2.5 expire_proposals → evt_proposal_expired
create or replace function public.expire_proposals()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int; v_id uuid;
begin
  v_count := 0;
  for v_id in
    update public.proposals
       set status = 'expirada'::public.proposal_status,
           expired_at = now()
     where valid_until is not null
       and valid_until < now()
       and status in ('rascunho','enviada','visualizada','ajustes_solicitados')
    returning id
  loop
    perform public.log_evt(v_id, 'evt_proposal_expired', '{}'::jsonb, 'system');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ------------------------------------------------------------
-- 3) submit_proposal_decision — guard atômico + idempotência
--    Critérios:
--      a) Bloqueia se proposta expirada (validade < now()).
--      b) Bloqueia se status já é terminal (aprovada/rejeitada/expirada/convertida).
--      c) Locka a linha (FOR UPDATE) para impedir double-click race.
--      d) Tipos de evento normalizados em evt_*.
--      e) Usa current_version_id sob o lock — não pega valor stale.
-- ------------------------------------------------------------
create or replace function public.submit_proposal_decision(
  p_token text,
  p_decisao text,
  p_nome text,
  p_cargo text default null,
  p_documento text default null,
  p_mensagem text default null,
  p_ua text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prop public.proposals%rowtype;
  v_briefing_id uuid;
  v_briefing_token text;
  v_new_status public.proposal_status;
  v_evt text;
begin
  -- lock pessimista da proposta inteira (idempotência + race)
  select * into v_prop
    from public.proposals
   where token_publico = p_token
   for update;
  if not found then raise exception 'proposta não encontrada'; end if;

  -- validade
  if v_prop.valid_until is not null and v_prop.valid_until < now() then
    raise exception 'proposta expirada em %', v_prop.valid_until
      using errcode = '22023';
  end if;

  -- status terminais — impede sobrescrita silenciosa
  if v_prop.status in ('aprovada','rejeitada','expirada','convertida') then
    raise exception 'proposta já finalizada (status=%)', v_prop.status
      using errcode = '22023';
  end if;

  v_new_status := case p_decisao
    when 'aprovada'  then 'aprovada'::public.proposal_status
    when 'ajustes'   then 'ajustes_solicitados'::public.proposal_status
    when 'rejeitada' then 'rejeitada'::public.proposal_status
    else null end;
  if v_new_status is null then raise exception 'decisão inválida'; end if;

  v_evt := case p_decisao
    when 'aprovada'  then 'evt_proposal_approved'
    when 'ajustes'   then 'evt_adjustments_requested'
    else 'evt_proposal_rejected' end;

  insert into public.proposal_approvals(
    proposal_id, version_id, decisao, nome, cargo, documento, mensagem, user_agent
  ) values (
    v_prop.id, v_prop.current_version_id, p_decisao::public.proposal_decision,
    p_nome, p_cargo, p_documento, p_mensagem, p_ua
  );

  update public.proposals
     set status = v_new_status,
         decided_at = now(),
         motivo_aprovacao = case when p_decisao='aprovada'  then coalesce(motivo_aprovacao, p_mensagem) else motivo_aprovacao end,
         motivo_perda     = case when p_decisao='rejeitada' then coalesce(motivo_perda,     p_mensagem) else motivo_perda end
   where id = v_prop.id;

  perform public.log_evt(
    v_prop.id, v_evt,
    jsonb_build_object('nome', p_nome, 'cargo', p_cargo, 'documento', p_documento,
                       'version_id', v_prop.current_version_id),
    'client'
  );

  -- Pipeline: aprovação → cria Briefing Comercial automaticamente
  if p_decisao = 'aprovada' then
    begin
      insert into public.briefings(user_id, tipo, status, lead_id, cliente_nome, empresa, telefone, email, servico, respostas_json, token_publico, proposal_id)
      select v_prop.user_id,
             'briefing_comercial',
             'pendente',
             v_prop.lead_id,
             coalesce(c.contact_name, p_nome),
             coalesce(c.company, pr.company, v_prop.titulo),
             coalesce(c.phone, pr.phone),
             coalesce(c.email, pr.email),
             'gestao_trafego',
             jsonb_build_object('proposal_id', v_prop.id, 'proposal_numero', v_prop.numero),
             translate(encode(gen_random_bytes(18),'base64'),'+/=','-_'),
             v_prop.id
        from public.proposals p
        left join public.clients c on c.id = p.client_id
        left join public.prospects pr on pr.id = p.lead_id
       where p.id = v_prop.id
      returning id, token_publico into v_briefing_id, v_briefing_token;

      perform public.log_evt(
        v_prop.id, 'evt_briefing_created',
        jsonb_build_object('briefing_id', v_briefing_id, 'token', v_briefing_token),
        'system'
      );
    exception when others then
      -- briefing falhou (schema antigo etc) — decisão já está commitada
      perform public.log_evt(
        v_prop.id, 'evt_briefing_creation_failed',
        jsonb_build_object('error', sqlerrm),
        'system'
      );
    end;
  end if;

  return jsonb_build_object(
    'status', v_new_status,
    'briefing_id', v_briefing_id,
    'briefing_token', v_briefing_token
  );
end $$;

notify pgrst, 'reload schema';