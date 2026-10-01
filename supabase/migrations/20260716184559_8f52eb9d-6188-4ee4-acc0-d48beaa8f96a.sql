-- ============================================================================
-- ISOLAMENTO POR USUÁRIO — FASE 1
-- Congela colunas operacionais de public.prospects para não-donos/não-admins
-- e adiciona override de admin/owner nas tabelas operacionais privadas.
-- ============================================================================

-- 1) prospects: trigger que reverte edições em colunas operacionais quando
--    o autor da mutação não é dono do registro nem admin/owner da org.
create or replace function public.prospects_freeze_shared_ops()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean := (old.user_id = auth.uid());
  v_is_admin boolean := (public.current_org_role() in ('owner','admin'));
begin
  if v_is_owner or v_is_admin then
    return new;
  end if;
  -- Membro comum não pode alterar operacional do lead compartilhado.
  new.status           := old.status;
  new.cadence_step     := old.cadence_step;
  new.cadence_status   := old.cadence_status;
  new.response_status  := old.response_status;
  new.last_contact_at  := old.last_contact_at;
  new.next_contact_at  := old.next_contact_at;
  new.closed_at        := old.closed_at;
  new.closed_reason    := old.closed_reason;
  -- user_id e organization_id também não podem mudar (roubo de titularidade).
  new.user_id          := old.user_id;
  new.organization_id  := old.organization_id;
  return new;
end $$;

drop trigger if exists trg_prospects_freeze_shared_ops on public.prospects;
create trigger trg_prospects_freeze_shared_ops
  before update on public.prospects
  for each row execute function public.prospects_freeze_shared_ops();

-- 2) prospect_touchpoints: adicionar override admin/owner.
--    A policy RESTRICTIVE atual impede admin de ver — trocá-la por org+role.
drop policy if exists touchpoints_owner_only_restrictive on public.prospect_touchpoints;
drop policy if exists "touchpoints owner read"   on public.prospect_touchpoints;
drop policy if exists "touchpoints owner insert" on public.prospect_touchpoints;
drop policy if exists "touchpoints owner update" on public.prospect_touchpoints;
drop policy if exists "touchpoints owner delete" on public.prospect_touchpoints;

create policy touchpoints_scope_by_role on public.prospect_touchpoints
  as permissive for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.current_org_role() in ('owner','admin') or user_id = auth.uid())
  )
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

-- 3) prospect_interactions: idem.
drop policy if exists interactions_owner_only_restrictive on public.prospect_interactions;
drop policy if exists "Users manage own prospect interactions" on public.prospect_interactions;

-- Garante organization_id para poder filtrar por org.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='prospect_interactions' and column_name='organization_id'
  ) then
    perform public._apply_tenant_isolation('prospect_interactions');
  end if;
end$$;

create policy interactions_scope_by_role on public.prospect_interactions
  as permissive for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.current_org_role() in ('owner','admin') or user_id = auth.uid())
  )
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

-- 4) briefings: mesmo padrão. Mantém tenant_isolation_restrictive (org).
drop policy if exists "own briefings" on public.briefings;

create policy briefings_scope_by_role on public.briefings
  as permissive for all to authenticated
  using (
    (organization_id is null or organization_id = public.current_org_id())
    and (public.current_org_role() in ('owner','admin') or user_id = auth.uid())
  )
  with check (
    (organization_id is null or organization_id = public.current_org_id())
    and user_id = auth.uid()
  );

-- 5) Sanity: garantir que handle_new_user_default_org NÃO copia operacional.
--    (função já só insere organization_members + user_active_org — nada a fazer.)

notify pgrst, 'reload schema';