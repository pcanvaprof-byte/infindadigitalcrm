-- ============================================================================
-- Cadência — correções da auditoria
--  1) cad_import_from_prospects usa user_id (organization_id não existe em prospects)
--  2) cad_register_send agenda a partir de primeira_abordagem_at, não de now()
--  3) view cad_notifications_v com security_invoker = true (respeita RLS)
-- ============================================================================

-- 1) Import correto: prospects.user_id, não organization_id
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
    'followup_1'::public.cad_stage,
    now() + interval '3 days'
  from public.prospects p
  where p.user_id = auth.uid()
    and (p_ids is null or p.id = any(p_ids))
    and not exists (select 1 from public.cad_leads cl where cl.prospect_id = p.id);

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.cad_import_from_prospects(uuid[]) to authenticated;

-- 2) Cronograma referenciado em primeira_abordagem_at (D+3,7,10,14,18,24,30)
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
  v_next_stage public.cad_stage;
  v_next_at timestamptz;
begin
  select * into v_lead from public.cad_leads where id = p_lead;
  if not found then raise exception 'lead não encontrado'; end if;

  insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
  values (p_lead, v_lead.organization_id, p_tipo, 'out', v_lead.stage, p_mensagem, 'enviada')
  returning id into v_msg_id;

  if p_advance and v_lead.stage::text like 'followup_%' and v_lead.stage <> 'followup_7' then
    v_next_stage := public.cad_next_stage(v_lead.stage);
    -- base = primeira_abordagem_at  (D+3,7,10,14,18,24,30)
    v_next_at := public.cad_next_action_for_stage(v_next_stage, v_lead.primeira_abordagem_at);
    -- garante que próxima ação não fique no passado
    if v_next_at is not null and v_next_at < now() then
      v_next_at := now() + interval '1 day';
    end if;
    update public.cad_leads
       set last_contact_at = now(),
           stage = v_next_stage,
           next_action_at = v_next_at
     where id = p_lead;
  else
    update public.cad_leads
       set last_contact_at = now()
     where id = p_lead;
  end if;

  return v_msg_id;
end $$;

grant execute on function public.cad_register_send(uuid, public.cad_msg_tipo, text, boolean) to authenticated;

-- 3) View precisa security_invoker para RLS aplicar ao chamador
drop view if exists public.cad_notifications_v;
create view public.cad_notifications_v
  with (security_invoker = true) as
select n.id, n.organization_id, n.lead_id, n.kind, n.payload, n.created_at, n.handled_at,
       l.empresa, l.responsavel, l.telefone, l.whatsapp,
       l.stage, l.next_action_at, l.last_response_at, l.temperatura
  from public.cad_notifications n
  join public.cad_leads l on l.id = n.lead_id;

grant select on public.cad_notifications_v to authenticated;
