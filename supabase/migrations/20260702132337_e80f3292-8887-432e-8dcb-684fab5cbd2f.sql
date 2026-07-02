
CREATE TABLE public.prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  cnpj TEXT,
  segment TEXT NOT NULL DEFAULT 'Outros',
  owner_name TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Importação',
  potential TEXT NOT NULL DEFAULT 'medio',
  status TEXT NOT NULL DEFAULT 'nao_contatado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX prospects_user_cnpj_uidx ON public.prospects(user_id, cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '';
CREATE INDEX prospects_user_idx ON public.prospects(user_id);
CREATE INDEX prospects_status_idx ON public.prospects(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prospects" ON public.prospects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.prospect_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prospect_interactions_prospect_idx ON public.prospect_interactions(prospect_id);
CREATE INDEX prospect_interactions_user_idx ON public.prospect_interactions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_interactions TO authenticated;
GRANT ALL ON public.prospect_interactions TO service_role;
ALTER TABLE public.prospect_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prospect interactions" ON public.prospect_interactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.prospect_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performed_by TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prospect_imports_user_idx ON public.prospect_imports(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_imports TO authenticated;
GRANT ALL ON public.prospect_imports TO service_role;
ALTER TABLE public.prospect_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prospect imports" ON public.prospect_imports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER prospects_set_updated_at BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  cnpj text not null,
  razao_social text, nome_fantasia text, situacao text, data_abertura date,
  natureza_juridica text, porte text, capital_social numeric,
  cnae_principal text, cnae_principal_desc text,
  cnaes_secundarios jsonb default '[]'::jsonb,
  socios jsonb default '[]'::jsonb, raw jsonb,
  telefone_1 text, telefone_2 text, email text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (user_id, cnpj)
);
grant select, insert, update, delete on public.company_profiles to authenticated;
grant all on public.company_profiles to service_role;
alter table public.company_profiles enable row level security;
create policy "own profiles" on public.company_profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
create policy "own addresses" on public.company_addresses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
create policy "own locations" on public.company_locations for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.company_market_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  municipio_ibge_id text, cidade text, uf text,
  populacao bigint, pib_total numeric, pib_per_capita numeric, idh numeric,
  fonte text default 'ibge', fetched_at timestamptz default now(),
  unique (user_id, municipio_ibge_id)
);
grant select, insert, update, delete on public.company_market_data to authenticated;
grant all on public.company_market_data to service_role;
alter table public.company_market_data enable row level security;
create policy "own market" on public.company_market_data for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
create policy "own scores" on public.company_scores for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
create policy "own logs" on public.company_enrichment_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_company_profiles_user on public.company_profiles(user_id);
create index if not exists idx_company_profiles_prospect on public.company_profiles(prospect_id);
create index if not exists idx_company_logs_profile on public.company_enrichment_logs(profile_id);

create table if not exists public.company_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.company_profiles(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  cnpj text,
  status text not null default 'Visitado'
    check (status in ('Planejada','Visitado','Sem sucesso','Fechado','Reagendar')),
  visited_at timestamptz not null default now(),
  lat double precision, lon double precision,
  endereco_snapshot text, contato_nome text, resultado text, observacoes text,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.company_visits to authenticated;
grant all on public.company_visits to service_role;
alter table public.company_visits enable row level security;
create policy "own visits" on public.company_visits for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_company_visits_user on public.company_visits(user_id, visited_at desc);
create index if not exists idx_company_visits_profile on public.company_visits(profile_id);

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null default 'briefing_comercial' check (tipo in ('briefing_comercial','kickoff_producao')),
  lead_id uuid references public.prospects(id) on delete set null,
  cliente_nome text, empresa text, telefone text, email text,
  servico text, status text not null default 'pendente',
  respostas_json jsonb not null default '{}'::jsonb,
  resumo_ia text,
  token_publico text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.briefings to authenticated;
grant all on public.briefings to service_role;
alter table public.briefings enable row level security;
create policy "own briefings" on public.briefings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_briefings_tipo_status on public.briefings(user_id, tipo, status);
create index if not exists idx_briefings_lead on public.briefings(lead_id);
create trigger briefings_set_updated_at before update on public.briefings for each row execute function public.set_updated_at();

create or replace function public.get_briefing_by_token(p_token text)
returns table (id uuid, tipo text, lead_id uuid, cliente_nome text, empresa text, telefone text, email text,
               servico text, status text, respostas_json jsonb, token_publico text, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, tipo, lead_id, cliente_nome, empresa, telefone, email,
         servico, status, respostas_json, token_publico, created_at, updated_at
    from public.briefings where token_publico = p_token limit 1;
$$;
grant execute on function public.get_briefing_by_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
