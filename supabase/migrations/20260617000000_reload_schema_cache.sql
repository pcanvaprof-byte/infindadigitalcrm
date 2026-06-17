-- Garante que as tabelas de enriquecimento existem e força PostgREST a recarregar o schema cache.

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  cnpj text not null,
  razao_social text,
  nome_fantasia text,
  situacao text,
  data_abertura date,
  natureza_juridica text,
  porte text,
  capital_social numeric,
  cnae_principal text,
  cnae_principal_desc text,
  cnaes_secundarios jsonb default '[]'::jsonb,
  socios jsonb default '[]'::jsonb,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, cnpj)
);
grant select, insert, update, delete on public.company_profiles to authenticated;
grant all on public.company_profiles to service_role;
alter table public.company_profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_profiles' and policyname='own profiles') then
    create policy "own profiles" on public.company_profiles for all to authenticated
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

notify pgrst, 'reload schema';
