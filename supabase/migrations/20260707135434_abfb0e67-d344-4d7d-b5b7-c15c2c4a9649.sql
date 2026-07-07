
-- 1) Tenant isolation on operacoes tables using existing helper
do $$
declare t text;
begin
  foreach t in array array['op_clientes','op_entregas','op_trafego_campanhas','op_trafego_contas','op_client_interactions'] loop
    perform public._apply_tenant_isolation(t);
  end loop;
end$$;

-- Drop the overly-permissive USING(true) policies now that restrictive
-- tenant_isolation_restrictive enforces org boundary.
drop policy if exists op_clientes_all on public.op_clientes;
drop policy if exists op_entregas_all on public.op_entregas;
drop policy if exists op_trafego_campanhas_all on public.op_trafego_campanhas;
drop policy if exists op_trafego_contas_all on public.op_trafego_contas;

-- Replace with permissive policies scoped to org membership (still ANDed
-- with the restrictive tenant policy for defense in depth).
create policy op_clientes_org_members on public.op_clientes
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy op_entregas_org_members on public.op_entregas
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy op_trafego_campanhas_org_members on public.op_trafego_campanhas
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy op_trafego_contas_org_members on public.op_trafego_contas
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- op_client_interactions keeps owner-scoped policy but now also org-scoped
-- (via restrictive tenant policy). Replace owner_id=auth.uid() ALL policy
-- with an owner+org one.
drop policy if exists op_client_interactions_owner on public.op_client_interactions;
create policy op_client_interactions_owner on public.op_client_interactions
  for all to authenticated
  using (owner_id = auth.uid() and organization_id = public.current_org_id())
  with check (owner_id = auth.uid() and organization_id = public.current_org_id());

-- 2) Tighten proposal_notes SELECT to also verify the caller owns the proposal
drop policy if exists "proposal_notes select same org" on public.proposal_notes;
create policy "proposal_notes select same org" on public.proposal_notes
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_notes.proposal_id
        and p.user_id = auth.uid()
    )
  );

-- 3) Fix mutable search_path on op_set_updated_at
create or replace function public.op_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end
$$;
