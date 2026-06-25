-- Adiciona plano (start/growth/scale) por organização e expõe no my_organizations()

do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_plan') then
    create type public.org_plan as enum ('start', 'growth', 'scale');
  end if;
end$$;

alter table public.organizations
  add column if not exists plan public.org_plan not null default 'scale';

-- atualizar helper para retornar o plano
create or replace function public.my_organizations()
returns table (id uuid, name text, slug text, role text, is_active boolean, plan public.org_plan)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.slug, m.role,
         (uao.organization_id = o.id) as is_active,
         o.plan
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  left join public.user_active_org uao on uao.user_id = auth.uid()
  where m.user_id = auth.uid()
  order by o.name
$$;

grant execute on function public.my_organizations() to authenticated;
