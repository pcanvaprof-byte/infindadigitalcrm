-- ============================================================================
-- Operações — Core (clientes, contas de tráfego, campanhas, entregas)
-- Compartilhado entre todos os usuários autenticados (sem org_id nesta v1).
-- ============================================================================

-- Helper trigger reutilizado em outras migrations
create or replace function public.op_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Enums ----------------------------------------------------------------------
do $$ begin
  create type public.op_cliente_status as enum ('ativo','pausado','offboarding','encerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.op_plataforma as enum ('meta_ads','google_ads','tiktok_ads','linkedin_ads');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.op_entrega_status as enum ('backlog','em_andamento','revisao','entregue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.op_entrega_tipo as enum ('criativo','relatorio','otimizacao','reuniao','outro');
exception when duplicate_object then null; end $$;

-- op_clientes ----------------------------------------------------------------
create table if not exists public.op_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text,
  email text,
  telefone text,
  whatsapp text,
  status public.op_cliente_status not null default 'ativo',
  responsavel_id uuid references auth.users(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.op_clientes to authenticated;
grant all on public.op_clientes to service_role;
alter table public.op_clientes enable row level security;

drop policy if exists op_clientes_all on public.op_clientes;
create policy op_clientes_all on public.op_clientes
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_op_clientes_updated on public.op_clientes;
create trigger trg_op_clientes_updated before update on public.op_clientes
  for each row execute function public.op_set_updated_at();

create index if not exists idx_op_clientes_status on public.op_clientes(status);

-- op_trafego_contas ----------------------------------------------------------
create table if not exists public.op_trafego_contas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.op_clientes(id) on delete cascade,
  plataforma public.op_plataforma not null,
  nome_conta text not null,
  conta_id_externa text,
  verba_mensal numeric(14,2) default 0,
  objetivo text,
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.op_trafego_contas to authenticated;
grant all on public.op_trafego_contas to service_role;
alter table public.op_trafego_contas enable row level security;

drop policy if exists op_trafego_contas_all on public.op_trafego_contas;
create policy op_trafego_contas_all on public.op_trafego_contas
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_op_trafego_contas_updated on public.op_trafego_contas;
create trigger trg_op_trafego_contas_updated before update on public.op_trafego_contas
  for each row execute function public.op_set_updated_at();

create index if not exists idx_op_trafego_contas_cliente on public.op_trafego_contas(cliente_id);

-- op_trafego_campanhas -------------------------------------------------------
create table if not exists public.op_trafego_campanhas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.op_clientes(id) on delete cascade,
  conta_id uuid references public.op_trafego_contas(id) on delete set null,
  plataforma public.op_plataforma not null,
  nome text not null,
  status text not null default 'ativa',
  verba numeric(14,2) default 0,
  gasto numeric(14,2) default 0,
  impressoes bigint default 0,
  cliques bigint default 0,
  conversoes bigint default 0,
  cpa numeric(14,2) default 0,
  roas numeric(8,2) default 0,
  periodo_inicio date,
  periodo_fim date,
  ultima_sync timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.op_trafego_campanhas to authenticated;
grant all on public.op_trafego_campanhas to service_role;
alter table public.op_trafego_campanhas enable row level security;

drop policy if exists op_trafego_campanhas_all on public.op_trafego_campanhas;
create policy op_trafego_campanhas_all on public.op_trafego_campanhas
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_op_trafego_campanhas_updated on public.op_trafego_campanhas;
create trigger trg_op_trafego_campanhas_updated before update on public.op_trafego_campanhas
  for each row execute function public.op_set_updated_at();

create index if not exists idx_op_trafego_camp_cliente on public.op_trafego_campanhas(cliente_id);

-- op_entregas ----------------------------------------------------------------
create table if not exists public.op_entregas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.op_clientes(id) on delete set null,
  titulo text not null,
  tipo public.op_entrega_tipo not null default 'outro',
  responsavel_id uuid references auth.users(id) on delete set null,
  status public.op_entrega_status not null default 'backlog',
  prazo date,
  descricao text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.op_entregas to authenticated;
grant all on public.op_entregas to service_role;
alter table public.op_entregas enable row level security;

drop policy if exists op_entregas_all on public.op_entregas;
create policy op_entregas_all on public.op_entregas
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_op_entregas_updated on public.op_entregas;
create trigger trg_op_entregas_updated before update on public.op_entregas
  for each row execute function public.op_set_updated_at();

create index if not exists idx_op_entregas_status on public.op_entregas(status);
create index if not exists idx_op_entregas_cliente on public.op_entregas(cliente_id);