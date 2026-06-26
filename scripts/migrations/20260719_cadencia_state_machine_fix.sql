-- ============================================================================
-- Cadência — correção da máquina de estados
--
-- Causa raiz: `cad_register_send` tratava `cad_leads.stage` como "próxima
-- etapa a enviar" e, ao registrar um envio, avançava para o próximo
-- follow-up. Resultado: lead criado nascia como followup_1 e, ao enviar a
-- primeira mensagem, virava followup_2 — sugerindo que FU2 já fora enviado.
--
-- Regra correta: `stage` representa SEMPRE a última etapa efetivamente
-- enviada. Elegibilidade da próxima etapa é cálculo dinâmico (stage +
-- last_contact_at + delay) e NÃO altera o banco.
--
-- Não há cron/job que altere `stage`. Os únicos caminhos para alterá-lo
-- continuam sendo cad_register_send (após envio) e cad_move_stage (manual).
-- ============================================================================

-- 1) Estado inicial "novo"
do $$ begin
  alter type public.cad_stage add value if not exists 'novo' before 'followup_1';
exception when others then null; end $$;

-- 2) Helper: próxima etapa a ENVIAR (novo -> followup_1, fu1 -> fu2, ...)
create or replace function public.cad_stage_to_send(p_current public.cad_stage)
returns public.cad_stage language sql immutable as $$
  select case p_current
    when 'novo'       then 'followup_1'::public.cad_stage
    when 'followup_1' then 'followup_2'::public.cad_stage
    when 'followup_2' then 'followup_3'::public.cad_stage
    when 'followup_3' then 'followup_4'::public.cad_stage
    when 'followup_4' then 'followup_5'::public.cad_stage
    when 'followup_5' then 'followup_6'::public.cad_stage
    when 'followup_6' then 'followup_7'::public.cad_stage
    else p_current
  end
$$;

-- 3) cad_register_send corrigido: stage = etapa enviada, nunca a próxima
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

  -- Sem avanço: nota/sistema, estados de saída, ou caller explícito.
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

  v_sent_stage := public.cad_stage_to_send(v_lead.stage);

  insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
  values (p_lead, v_lead.organization_id, p_tipo, 'out', v_sent_stage, p_mensagem, 'enviada')
  returning id into v_msg_id;

  v_next_eligible := public.cad_next_stage(v_sent_stage);
  if v_next_eligible <> v_sent_stage then
    v_next_at := public.cad_next_action_for_stage(v_next_eligible, now());
  else
    v_next_at := null;
  end if;

  update public.cad_leads
     set last_contact_at = now(),
         stage = v_sent_stage,        -- LAST sent
         next_action_at = v_next_at   -- informativo
   where id = p_lead;

  return v_msg_id;
end $$;

grant execute on function public.cad_register_send(uuid, public.cad_msg_tipo, text, boolean) to authenticated;

-- 4) Import: começa em 'novo', elegível imediatamente
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
    coalesce(p.created_at, now()),
    'novo'::public.cad_stage,
    now()
  from public.prospects p
  where p.user_id = auth.uid()
    and (p_ids is null or p.id = any(p_ids))
    and not exists (select 1 from public.cad_leads cl where cl.prospect_id = p.id);

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.cad_import_from_prospects(uuid[]) to authenticated;

-- 5) Backfill conservador
-- 5a) Leads em followup_* sem nenhuma mensagem out voltam para 'novo'.
update public.cad_leads l
   set stage = 'novo', next_action_at = now()
 where l.stage::text like 'followup_%'
   and not exists (
     select 1 from public.cad_messages m
      where m.lead_id = l.id
        and m.direction = 'out'
        and m.tipo in ('whatsapp','email','ligacao')
   );

-- 5b) Leads cujo stage atual está à frente da última mensagem enviada são
-- recuados para o stage realmente enviado.
update public.cad_leads l
   set stage = last_sent.stage_at_send
  from (
    select distinct on (m.lead_id) m.lead_id, m.stage_at_send
      from public.cad_messages m
     where m.direction = 'out'
       and m.tipo in ('whatsapp','email','ligacao')
       and m.stage_at_send::text like 'followup_%'
     order by m.lead_id, m.created_at desc
  ) last_sent
 where last_sent.lead_id = l.id
   and l.stage::text like 'followup_%'
   and last_sent.stage_at_send is not null
   and l.stage <> last_sent.stage_at_send
   and (case l.stage
          when 'followup_1' then 1 when 'followup_2' then 2 when 'followup_3' then 3
          when 'followup_4' then 4 when 'followup_5' then 5 when 'followup_6' then 6
          when 'followup_7' then 7 else 0 end)
     > (case last_sent.stage_at_send
          when 'followup_1' then 1 when 'followup_2' then 2 when 'followup_3' then 3
          when 'followup_4' then 4 when 'followup_5' then 5 when 'followup_6' then 6
          when 'followup_7' then 7 else 0 end);
