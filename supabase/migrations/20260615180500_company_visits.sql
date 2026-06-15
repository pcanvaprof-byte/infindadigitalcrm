-- Enriquecimento — contatos e visitas PAP
alter table public.company_profiles
  add column if not exists telefone_1 text,
  add column if not exists telefone_2 text,
  add column if not exists email text;

create table if not exists public.company_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.company_profiles(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  cnpj text,
  status text not null default 'Visitado'
    check (status in ('Planejada','Visitado','Sem sucesso','Fechado','Reagendar')),
  visited_at timestamptz not null default now(),
  lat double precision,
  lon double precision,
  endereco_snapshot text,
  contato_nome text,
  resultado text,
  observacoes text,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.company_visits to authenticated;
grant all on public.company_visits to service_role;
alter table public.company_visits enable row level security;
create policy "own visits" on public.company_visits for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_company_visits_profile on public.company_visits(profile_id);
create index if not exists idx_company_visits_user on public.company_visits(user_id);
create index if not exists idx_company_visits_cnpj on public.company_visits(cnpj);
