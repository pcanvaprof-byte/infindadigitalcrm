-- 20260741_user_roles_table.sql
-- Cria tabela user_roles + has_role() (padrão Supabase) para parar 404s do front
-- e habilitar futuras checagens de admin/consultor sem privilege escalation.

do $$ begin
  create type public.app_role as enum ('admin', 'consultor', 'gestor');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

drop policy if exists "user_roles self select" on public.user_roles;
create policy "user_roles self select"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon;

notify pgrst, 'reload schema';