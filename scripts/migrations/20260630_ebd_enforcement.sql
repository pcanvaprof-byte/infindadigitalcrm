-- ============================================================
-- INFINDA — EBD Enforcement (DB-level)
-- Garante que INSERT em proposal_events só passe pelo helper log_evt
-- e que tipos sigam o prefixo evt_*.
-- Auditoria (aud_*) é separada e nunca cruza com BI.
-- Ver docs/architecture/event-boundaries.md
-- ============================================================

-- 1) Revoga INSERT direto em proposal_events.
--    O helper log_evt() é SECURITY DEFINER, então continua funcionando.
revoke insert on public.proposal_events from authenticated;
revoke insert on public.proposal_events from anon;

-- 2) Constraint de prefixo: todo tipo precisa começar com evt_.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'proposal_events_tipo_prefix_chk'
  ) then
    alter table public.proposal_events
      add constraint proposal_events_tipo_prefix_chk
      check (tipo ~ '^evt_');
  end if;
end $$;

-- 3) Bloqueio de UPDATE/DELETE — append-only.
create or replace function public.tg_pe_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'proposal_events é append-only (EBD)';
end $$;

drop trigger if exists tg_pe_no_update on public.proposal_events;
create trigger tg_pe_no_update before update on public.proposal_events
  for each row execute function public.tg_pe_append_only();

drop trigger if exists tg_pe_no_delete on public.proposal_events;
create trigger tg_pe_no_delete before delete on public.proposal_events
  for each row execute function public.tg_pe_append_only();

-- 4) Mesma regra para audit_logs.
create or replace function public.tg_aud_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs é append-only (EBD)';
end $$;

drop trigger if exists tg_aud_no_update on public.audit_logs;
create trigger tg_aud_no_update before update on public.audit_logs
  for each row execute function public.tg_aud_append_only();

drop trigger if exists tg_aud_no_delete on public.audit_logs;
create trigger tg_aud_no_delete before delete on public.audit_logs
  for each row execute function public.tg_aud_append_only();

notify pgrst, 'reload schema';