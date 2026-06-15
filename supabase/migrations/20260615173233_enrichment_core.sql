-- Enriquecimento de Leads — Fase 1+2

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
create policy "own profiles" on public.company_profiles for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.company_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  cep text, logradouro text, numero text, complemento text,
  bairro text, cidade text, uf text, regiao text,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.company_addresses to authenticated;
grant all on public.company_addresses to service_role;
alter table public.company_addresses enable row level security;
create policy "own addresses" on public.company_addresses for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.company_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  lat double precision, lon double precision,
  display_name text, source text default 'nominatim',
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.company_locations to authenticated;
grant all on public.company_locations to service_role;
alter table public.company_locations enable row level security;
create policy "own locations" on public.company_locations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.company_market_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  municipio_ibge_id text,
  cidade text, uf text,
  populacao bigint, pib_total numeric, pib_per_capita numeric, idh numeric,
  fonte text default 'ibge',
  fetched_at timestamptz default now(),
  unique (user_id, municipio_ibge_id)
);
grant select, insert, update, delete on public.company_market_data to authenticated;
grant all on public.company_market_data to service_role;
alter table public.company_market_data enable row level security;
create policy "own market" on public.company_market_data for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.company_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  lead_score int, market_score int, classificacao text,
  breakdown jsonb, calculated_at timestamptz default now()
);
grant select, insert, update, delete on public.company_scores to authenticated;
grant all on public.company_scores to service_role;
alter table public.company_scores enable row level security;
create policy "own scores" on public.company_scores for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.company_enrichment_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.company_profiles(id) on delete cascade,
  cnpj text, step text not null, status text not null,
  message text, payload jsonb,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.company_enrichment_logs to authenticated;
grant all on public.company_enrichment_logs to service_role;
alter table public.company_enrichment_logs enable row level security;
create policy "own logs" on public.company_enrichment_logs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_company_profiles_user on public.company_profiles(user_id);
create index if not exists idx_company_profiles_prospect on public.company_profiles(prospect_id);
create index if not exists idx_company_logs_profile on public.company_enrichment_logs(profile_id);
