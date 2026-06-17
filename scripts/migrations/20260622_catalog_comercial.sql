-- ============================================================
-- INFINDA — Sub-fase 2.1 — Catálogo Comercial
-- Módulo central reutilizado por Propostas, Projetos,
-- Financeiro, Produção, IA e Relatórios.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- ---------- Enums ----------
do $$ begin
  create type public.catalog_tipo as enum ('servico','pacote','complemento','bonus');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.catalog_cobranca as enum ('implantacao','mensal','avulso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.catalog_complexidade as enum ('baixa','media','alta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.catalog_area as enum (
    'comercial','marketing','desenvolvimento','design','ia','suporte','outros'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.catalog_rel_tipo as enum ('complemento','dependencia');
exception when duplicate_object then null; end $$;

-- ---------- Categorias ----------
create table if not exists public.catalog_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  slug text not null unique,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.catalog_categorias
  add column if not exists nome text,
  add column if not exists slug text,
  add column if not exists ordem int not null default 0,
  add column if not exists ativo boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

grant select, insert, update, delete on public.catalog_categorias to authenticated;
grant all on public.catalog_categorias to service_role;

alter table public.catalog_categorias enable row level security;

drop policy if exists "catalog_categorias read" on public.catalog_categorias;
create policy "catalog_categorias read" on public.catalog_categorias
  for select to authenticated using (true);

drop policy if exists "catalog_categorias write" on public.catalog_categorias;
create policy "catalog_categorias write" on public.catalog_categorias
  for all to authenticated using (true) with check (true);

-- Seed das categorias iniciais
insert into public.catalog_categorias (nome, slug, ordem) values
  ('Gestão de Tráfego',       'gestao-trafego',     10),
  ('Desenvolvimento',         'desenvolvimento',    20),
  ('Websites',                'websites',           30),
  ('Landing Pages',           'landing-pages',      40),
  ('E-commerce',              'ecommerce',          50),
  ('CRM',                     'crm',                60),
  ('Automações',              'automacoes',         70),
  ('Agentes IA',              'agentes-ia',         80),
  ('Identidade Visual',       'identidade-visual',  90),
  ('Branding',                'branding',          100),
  ('Consultorias',            'consultorias',      110),
  ('Mentorias',               'mentorias',         120),
  ('Suporte',                 'suporte',           130),
  ('Outros',                  'outros',            999)
on conflict (slug) do nothing;

-- ---------- Itens do Catálogo ----------
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),

  -- Identidade
  tipo public.catalog_tipo not null default 'servico',
  codigo text unique,
  nome_comercial text not null,
  nome_interno text,
  categoria_id uuid references public.catalog_categorias(id) on delete restrict,
  subcategoria text,

  -- Descritivo
  descricao_curta text,
  descricao_completa text,
  beneficios text[] not null default '{}',
  entregaveis text[] not null default '{}',
  nao_incluso text[] not null default '{}',

  -- Operacional / produção
  prazo_estimado_dias int,
  complexidade public.catalog_complexidade not null default 'media',
  prioridade int not null default 0,
  area_responsavel public.catalog_area not null default 'comercial',
  tempo_execucao_horas numeric(10,2),
  objetivo text,

  -- Valores (separados conforme decisão da Fase 2.1)
  cobranca public.catalog_cobranca not null default 'implantacao',
  valor_implantacao numeric(12,2) not null default 0,
  valor_mensal numeric(12,2) not null default 0,
  valor_avulso numeric(12,2) not null default 0,

  -- Exibição / status
  ativo boolean not null default true,
  ordem int not null default 0,
  tags text[] not null default '{}',
  observacoes_internas text,

  -- Audit
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_items
  add column if not exists tipo public.catalog_tipo not null default 'servico',
  add column if not exists codigo text,
  add column if not exists nome_comercial text,
  add column if not exists nome_interno text,
  add column if not exists categoria_id uuid references public.catalog_categorias(id) on delete restrict,
  add column if not exists subcategoria text,
  add column if not exists descricao_curta text,
  add column if not exists descricao_completa text,
  add column if not exists beneficios text[] not null default '{}',
  add column if not exists entregaveis text[] not null default '{}',
  add column if not exists nao_incluso text[] not null default '{}',
  add column if not exists prazo_estimado_dias int,
  add column if not exists complexidade public.catalog_complexidade not null default 'media',
  add column if not exists prioridade int not null default 0,
  add column if not exists area_responsavel public.catalog_area not null default 'comercial',
  add column if not exists tempo_execucao_horas numeric(10,2),
  add column if not exists objetivo text,
  add column if not exists cobranca public.catalog_cobranca not null default 'implantacao',
  add column if not exists valor_implantacao numeric(12,2) not null default 0,
  add column if not exists valor_mensal numeric(12,2) not null default 0,
  add column if not exists valor_avulso numeric(12,2) not null default 0,
  add column if not exists ativo boolean not null default true,
  add column if not exists ordem int not null default 0,
  add column if not exists tags text[] not null default '{}',
  add column if not exists observacoes_internas text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.catalog_items
set nome_comercial = coalesce(nullif(nome_interno, ''), codigo, 'Item sem nome')
where nome_comercial is null;

alter table public.catalog_items
  alter column nome_comercial set not null;

create unique index if not exists catalog_items_codigo_key
  on public.catalog_items(codigo)
  where codigo is not null;

grant select, insert, update, delete on public.catalog_items to authenticated;
grant all on public.catalog_items to service_role;

alter table public.catalog_items enable row level security;

drop policy if exists "catalog_items read" on public.catalog_items;
create policy "catalog_items read" on public.catalog_items
  for select to authenticated using (true);

drop policy if exists "catalog_items write" on public.catalog_items;
create policy "catalog_items write" on public.catalog_items
  for all to authenticated using (true) with check (true);

create index if not exists idx_catalog_items_categoria on public.catalog_items(categoria_id);
create index if not exists idx_catalog_items_tipo on public.catalog_items(tipo);
create index if not exists idx_catalog_items_ativo on public.catalog_items(ativo);
create index if not exists idx_catalog_items_area on public.catalog_items(area_responsavel);

-- ---------- Relacionamentos (Upsell / Dependências) ----------
create table if not exists public.catalog_relacionamentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.catalog_items(id) on delete cascade,
  relacionado_id uuid not null references public.catalog_items(id) on delete cascade,
  tipo public.catalog_rel_tipo not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  unique (item_id, relacionado_id, tipo),
  check (item_id <> relacionado_id)
);

grant select, insert, update, delete on public.catalog_relacionamentos to authenticated;
grant all on public.catalog_relacionamentos to service_role;

alter table public.catalog_relacionamentos enable row level security;

drop policy if exists "catalog_rel read" on public.catalog_relacionamentos;
create policy "catalog_rel read" on public.catalog_relacionamentos
  for select to authenticated using (true);

drop policy if exists "catalog_rel write" on public.catalog_relacionamentos;
create policy "catalog_rel write" on public.catalog_relacionamentos
  for all to authenticated using (true) with check (true);

create index if not exists idx_catalog_rel_item on public.catalog_relacionamentos(item_id);
create index if not exists idx_catalog_rel_relacionado on public.catalog_relacionamentos(relacionado_id);

-- ---------- Trigger updated_at ----------
create or replace function public.catalog_items_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_catalog_items_updated_at on public.catalog_items;
create trigger trg_catalog_items_updated_at
  before update on public.catalog_items
  for each row execute function public.catalog_items_set_updated_at();

-- ---------- Reload PostgREST schema cache ----------
notify pgrst, 'reload schema';