-- ============================================================================
-- Cadência — Notificações de follow-up vencido / última tentativa / sem retorno
-- ============================================================================

do $$ begin
  create type public.cad_notif_kind as enum ('overdue','last_attempt','response_pending');
exception when duplicate_object then null; end $$;

create table if not exists public.cad_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id()
    references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.cad_leads(id) on delete cascade,
  kind public.cad_notif_kind not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_cad_notif_org on public.cad_notifications(organization_id, handled_at);
create index if not exists idx_cad_notif_lead on public.cad_notifications(lead_id);
-- garante apenas uma notif pendente por (lead, kind)
create unique index if not exists ux_cad_notif_pending
  on public.cad_notifications(lead_id, kind) where handled_at is null;

grant select, insert, update, delete on public.cad_notifications to authenticated;
grant all on public.cad_notifications to service_role;

alter table public.cad_notifications enable row level security;

drop policy if exists cad_notif_select on public.cad_notifications;
create policy cad_notif_select on public.cad_notifications
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists cad_notif_write on public.cad_notifications;
create policy cad_notif_write on public.cad_notifications
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- recalcula notificações pendentes para a org atual
create or replace function public.cad_refresh_notifications()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_count int := 0;
  v_added int := 0;
begin
  if v_org is null then return 0; end if;

  -- 1) follow-ups vencidos (qualquer etapa de follow-up < 7)
  insert into public.cad_notifications (organization_id, lead_id, kind, payload)
  select v_org, l.id, 'overdue',
         jsonb_build_object(
           'stage', l.stage::text,
           'next_action_at', l.next_action_at,
           'empresa', l.empresa
         )
  from public.cad_leads l
  where l.organization_id = v_org
    and l.stage::text like 'followup_%'
    and l.stage <> 'followup_7'
    and l.closed_at is null
    and l.next_action_at is not null
    and l.next_action_at < now()
    and not exists (
      select 1 from public.cad_notifications n
      where n.lead_id = l.id and n.kind = 'overdue' and n.handled_at is null
    );
  get diagnostics v_added = row_count; v_count := v_count + v_added;

  -- 2) última tentativa (followup_7) vencida
  insert into public.cad_notifications (organization_id, lead_id, kind, payload)
  select v_org, l.id, 'last_attempt',
         jsonb_build_object(
           'next_action_at', l.next_action_at,
           'empresa', l.empresa
         )
  from public.cad_leads l
  where l.organization_id = v_org
    and l.stage = 'followup_7'
    and l.closed_at is null
    and (l.next_action_at is null or l.next_action_at < now())
    and not exists (
      select 1 from public.cad_notifications n
      where n.lead_id = l.id and n.kind = 'last_attempt' and n.handled_at is null
    );
  get diagnostics v_added = row_count; v_count := v_count + v_added;

  -- 3) lead respondeu e ainda não houve registro de resposta tratada
  --    (resposta recente sem nenhuma mensagem out posterior)
  insert into public.cad_notifications (organization_id, lead_id, kind, payload)
  select v_org, l.id, 'response_pending',
         jsonb_build_object(
           'last_response_at', l.last_response_at,
           'empresa', l.empresa
         )
  from public.cad_leads l
  where l.organization_id = v_org
    and l.closed_at is null
    and l.last_response_at is not null
    and not exists (
      select 1 from public.cad_messages m
      where m.lead_id = l.id
        and m.direction = 'out'
        and m.created_at > l.last_response_at
    )
    and not exists (
      select 1 from public.cad_notifications n
      where n.lead_id = l.id and n.kind = 'response_pending' and n.handled_at is null
    );
  get diagnostics v_added = row_count; v_count := v_count + v_added;

  return v_count;
end $$;

grant execute on function public.cad_refresh_notifications() to authenticated;

-- marca uma notificação como tratada
create or replace function public.cad_mark_notification_handled(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.cad_notifications
     set handled_at = now(),
         handled_by = auth.uid()
   where id = p_id and handled_at is null;
end $$;

grant execute on function public.cad_mark_notification_handled(uuid) to authenticated;

-- marca todas como tratadas (org atual)
create or replace function public.cad_mark_all_notifications_handled()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.cad_notifications
     set handled_at = now(), handled_by = auth.uid()
   where organization_id = public.current_org_id()
     and handled_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.cad_mark_all_notifications_handled() to authenticated;

-- view enriquecida com dados do lead (útil para listagem)
create or replace view public.cad_notifications_v as
select n.id, n.organization_id, n.lead_id, n.kind, n.payload, n.created_at, n.handled_at,
       l.empresa, l.responsavel, l.telefone, l.whatsapp,
       l.stage, l.next_action_at, l.last_response_at, l.temperatura
  from public.cad_notifications n
  join public.cad_leads l on l.id = n.lead_id;

grant select on public.cad_notifications_v to authenticated;-- ============================================================================
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
