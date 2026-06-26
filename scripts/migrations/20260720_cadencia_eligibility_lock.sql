-- ============================================================================
-- Cadência — trava de elegibilidade por data
--
-- Regras:
-- 1) Intervalos oficiais entre etapas (relativos ao envio anterior):
--      novo → FU1: +2d   FU1→FU2: +3d   FU2→FU3: +5d   FU3→FU4: +7d
--      FU4→FU5: +10d    FU5→FU6: +14d  FU6→FU7: +21d
-- 2) cad_register_send NÃO aceita envio se now() < next_action_at.
-- 3) Ao mover para outcome (interessado, reuniao, proposta, negociacao,
--    fechado, perdido) o lead sai da fila: next_action_at := null.
-- 4) Import: lead nasce em 'novo' com next_action_at = primeira_abordagem_at + 2d
--    (data do contato inicial vinda da Prospecção).
-- ============================================================================

-- 1) Intervalos oficiais por etapa de DESTINO (a etapa que será enviada).
create or replace function public.cad_next_action_for_stage(p_stage public.cad_stage, p_base timestamptz)
returns timestamptz language sql immutable as $$
  select case p_stage
    when 'followup_1' then p_base + interval '2 days'
    when 'followup_2' then p_base + interval '3 days'
    when 'followup_3' then p_base + interval '5 days'
    when 'followup_4' then p_base + interval '7 days'
    when 'followup_5' then p_base + interval '10 days'
    when 'followup_6' then p_base + interval '14 days'
    when 'followup_7' then p_base + interval '21 days'
    else null
  end
$$;

-- 2) cad_register_send com trava de elegibilidade.
create or replace function public.cad_register_send(
  p_lead uuid,
  p_tipo public.cad_msg_tipo,
  p_mensagem text,
  p_advance boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_lead public.cad_leads%rowtype;
  v_msg_id uuid;
  v_sent_stage public.cad_stage;
  v_next_eligible public.cad_stage;
  v_next_at timestamptz;
begin
  select * into v_lead from public.cad_leads where id = p_lead;
  if not found then raise exception 'lead não encontrado'; end if;

  -- Sem avanço: nota/sistema, ou lead já fora da cadência (outcome).
  if not p_advance
     or p_tipo in ('nota','sistema')
     or v_lead.stage in ('fechado','perdido','interessado','reuniao_agendada',
                         'proposta_enviada','negociacao')
  then
    insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
    values (p_lead, v_lead.organization_id, p_tipo, 'out', v_lead.stage, p_mensagem, 'enviada')
    returning id into v_msg_id;

    update public.cad_leads set last_contact_at = now() where id = p_lead;
    return v_msg_id;
  end if;

  -- TRAVA DE ELEGIBILIDADE: não pode disparar antes da data programada.
  if v_lead.next_action_at is not null and now() < v_lead.next_action_at then
    raise exception 'Follow-up ainda não disponível. Próximo envio permitido em % (lead %).',
      to_char(v_lead.next_action_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      v_lead.empresa
      using errcode = 'P0001';
  end if;

  v_sent_stage := public.cad_stage_to_send(v_lead.stage);

  insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
  values (p_lead, v_lead.organization_id, p_tipo, 'out', v_sent_stage, p_mensagem, 'enviada')
  returning id into v_msg_id;

  v_next_eligible := public.cad_next_stage(v_sent_stage);
  if v_next_eligible <> v_sent_stage then
    v_next_at := public.cad_next_action_for_stage(v_next_eligible, now());
  else
    v_next_at := null;  -- FU7 enviado: ciclo encerrado, sem próximo agendamento
  end if;

  update public.cad_leads
     set last_contact_at = now(),
         stage = v_sent_stage,
         next_action_at = v_next_at
   where id = p_lead;

  return v_msg_id;
end $$;

grant execute on function public.cad_register_send(uuid, public.cad_msg_tipo, text, boolean) to authenticated;

-- 3) cad_move_stage limpa next_action_at quando vai para outcome
--    (lead sai da fila de cadência imediatamente).
create or replace function public.cad_move_stage(p_lead uuid, p_stage public.cad_stage)
returns void language plpgsql security definer set search_path = public as $$
declare v_lead public.cad_leads%rowtype;
begin
  select * into v_lead from public.cad_leads where id = p_lead;
  if not found then raise exception 'lead não encontrado'; end if;

  update public.cad_leads
     set stage = p_stage,
         next_action_at = case
           when p_stage in ('fechado','perdido','interessado','reuniao_agendada',
                            'proposta_enviada','negociacao') then null
           else next_action_at
         end,
         closed_at = case when p_stage in ('fechado','perdido') then now() else null end
   where id = p_lead;

  insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
  values (p_lead, v_lead.organization_id, 'sistema', 'system', p_stage,
          'Movido de ' || v_lead.stage::text || ' para ' || p_stage::text, 'enviada');
end $$;

grant execute on function public.cad_move_stage(uuid, public.cad_stage) to authenticated;

-- 4) Import: lead nasce 'novo' com next_action_at = primeira_abordagem_at + 2d.
create or replace function public.cad_import_from_prospects(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into public.cad_leads (
    organization_id, owner_id, prospect_id, empresa, responsavel, cargo, telefone, whatsapp,
    primeira_abordagem_at, stage, next_action_at
  )
  select
    public.current_org_id(),
    auth.uid(),
    p.id,
    coalesce(p.company, 'Sem nome'),
    p.owner_name,
    null::text,
    p.phone,
    p.whatsapp,
    coalesce(
      (select max(t.enviado_em) from public.prospect_touchpoints t where t.prospect_id = p.id),
      p.created_at,
      now()
    ),
    'novo'::public.cad_stage,
    coalesce(
      (select max(t.enviado_em) from public.prospect_touchpoints t where t.prospect_id = p.id),
      p.created_at,
      now()
    ) + interval '2 days'
  from public.prospects p
  where p.user_id = auth.uid()
    and (p_ids is null or p.id = any(p_ids))
    and not exists (select 1 from public.cad_leads cl where cl.prospect_id = p.id);

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.cad_import_from_prospects(uuid[]) to authenticated;

-- 5) Backfill: leads em outcome sem next_action_at limpo
update public.cad_leads
   set next_action_at = null
 where stage in ('fechado','perdido','interessado','reuniao_agendada',
                 'proposta_enviada','negociacao')
   and next_action_at is not null;

-- 6) Backfill: leads 'novo' sem next_action_at recebem primeira_abordagem_at + 2d
update public.cad_leads
   set next_action_at = coalesce(primeira_abordagem_at, created_at, now()) + interval '2 days'
 where stage = 'novo'
   and next_action_at is null;