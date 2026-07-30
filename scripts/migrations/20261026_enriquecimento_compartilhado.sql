-- Enriquecimento compartilhado por organizacao (leitura), escrita permanece do dono
create or replace function public.shares_org_with(_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _other = auth.uid() or exists (
    select 1
    from public.organization_members me
    join public.organization_members other
      on other.organization_id = me.organization_id
    where me.user_id = auth.uid()
      and other.user_id = _other
  )
$$;

revoke all on function public.shares_org_with(uuid) from public;
grant execute on function public.shares_org_with(uuid) to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'company_profiles','company_addresses','company_locations',
    'company_market_data','company_scores','company_visits'
  ] loop
    execute format('drop policy if exists "org shared read" on public.%I', t);
    execute format(
      'create policy "org shared read" on public.%I for select to authenticated using (public.shares_org_with(user_id))', t);
  end loop;
end $$;
