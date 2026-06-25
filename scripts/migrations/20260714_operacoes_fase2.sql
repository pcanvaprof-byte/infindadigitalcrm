-- ============================================================================
-- Operações Fase 2 — Onboarding, Implantação, Campanhas, Relacionamento,
-- Renovações + Dashboard Executivo (views).
--
-- Ajustes incorporados:
--   * owner_id por linha + RLS escopada ao usuário (auth.uid()).
--   * Sem coluna progress armazenada; view op_onboarding_progress.
--   * Sem trigger de status em renovações; view op_renewals_status.
--   * Dashboard como VIEW (não RPC JSON).
--   * Campos extras: priority, monthly_budget/investment_to_date/results_count/
--     cost_per_result, next_followup_at.
--
-- Não altera tabelas existentes (op_clientes etc.). Não toca CRM, Prospecção
-- ou Cadência.
-- ============================================================================

-- Reusa public.op_set_updated_at() criado em 20260712_operacoes_core.sql

-- ---------- op_onboarding ---------------------------------------------------
create table if not exists public.op_onboarding (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.op_clientes(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_name text,
  cnpj text,
  website text,
  instagram text,
  facebook text,
  youtube text,
  meta_ads_connected boolean not null default false,
  google_ads_connected boolean not null default false,
  analytics_connected boolean not null default false,
  tag_manager_connected boolean not null default false,
  goal_type text,
  status text not null default 'pendente'
    check (status in ('pendente','aguardando_cliente','em_configuracao','concluido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, client_id)
);

grant select, insert, update, delete on public.op_onboarding to authenticated;
grant all on public.op_onboarding to service_role;
alter table public.op_onboarding enable row level security;

drop policy if exists op_onboarding_owner on public.op_onboarding;
create policy op_onboarding_owner on public.op_onboarding
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop trigger if exists trg_op_onboarding_updated on public.op_onboarding;
create trigger trg_op_onboarding_updated before update on public.op_onboarding
  for each row execute function public.op_set_updated_at();

create index if not exists idx_op_onboarding_client on public.op_onboarding(client_id);
create index if not exists idx_op_onboarding_owner on public.op_onboarding(owner_id);

-- ---------- op_deployments --------------------------------------------------
create table if not exists public.op_deployments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.op_clientes(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null
    check (category in ('Pixel','CAPI','Analytics','Tag Manager','Landing Page',
                        'Google Ads','Meta Ads','CRM','Automação')),
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado','em_andamento','aguardando_aprovacao','concluido')),
  priority text not null default 'Normal'
    check (priority in ('Baixa','Normal','Alta','Crítica')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.op_deployments to authenticated;
grant all on public.op_deployments to service_role;
alter table public.op_deployments enable row level security;

drop policy if exists op_deployments_owner on public.op_deployments;
create policy op_deployments_owner on public.op_deployments
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop trigger if exists trg_op_deployments_updated on public.op_deployments;
create trigger trg_op_deployments_updated before update on public.op_deployments
  for each row execute function public.op_set_updated_at();

create index if not exists idx_op_deployments_client on public.op_deployments(client_id);
create index if not exists idx_op_deployments_owner on public.op_deployments(owner_id);
create index if not exists idx_op_deployments_status on public.op_deployments(status);

-- ---------- op_campaigns (gestão de campanhas, separada de op_trafego_*) ----
create table if not exists public.op_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.op_clientes(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  campaign_name text not null,
  platform text not null
    check (platform in ('Meta Ads','Google Ads','TikTok Ads','LinkedIn Ads')),
  objective text,
  daily_budget numeric(14,2) default 0,
  monthly_budget numeric(14,2) default 0,
  investment_to_date numeric(14,2) default 0,
  results_count numeric(14,2) default 0,
  cost_per_result numeric(14,2) default 0,
  status text not null default 'rascunho'
    check (status in ('rascunho','ativa','pausada','encerrada')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.op_campaigns to authenticated;
grant all on public.op_campaigns to service_role;
alter table public.op_campaigns enable row level security;

drop policy if exists op_campaigns_owner on public.op_campaigns;
create policy op_campaigns_owner on public.op_campaigns
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop trigger if exists trg_op_campaigns_updated on public.op_campaigns;
create trigger trg_op_campaigns_updated before update on public.op_campaigns
  for each row execute function public.op_set_updated_at();

create index if not exists idx_op_campaigns_client on public.op_campaigns(client_id);
create index if not exists idx_op_campaigns_owner on public.op_campaigns(owner_id);
create index if not exists idx_op_campaigns_status on public.op_campaigns(status);

-- ---------- op_client_interactions ------------------------------------------
create table if not exists public.op_client_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.op_clientes(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  interaction_type text not null
    check (interaction_type in ('WhatsApp','Ligação','Reunião','E-mail','Suporte','Solicitação')),
  title text not null,
  notes text,
  interaction_date timestamptz not null default now(),
  next_followup_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.op_client_interactions to authenticated;
grant all on public.op_client_interactions to service_role;
alter table public.op_client_interactions enable row level security;

drop policy if exists op_client_interactions_owner on public.op_client_interactions;
create policy op_client_interactions_owner on public.op_client_interactions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create index if not exists idx_op_inter_client on public.op_client_interactions(client_id);
create index if not exists idx_op_inter_owner on public.op_client_interactions(owner_id);
create index if not exists idx_op_inter_date on public.op_client_interactions(interaction_date desc);
create index if not exists idx_op_inter_followup on public.op_client_interactions(next_followup_at);

-- ---------- op_contract_renewals --------------------------------------------
create table if not exists public.op_contract_renewals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.op_clientes(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contract_start date,
  contract_end date not null,
  renewal_status text not null default 'ativo'
    check (renewal_status in ('ativo','renovado','cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.op_contract_renewals to authenticated;
grant all on public.op_contract_renewals to service_role;
alter table public.op_contract_renewals enable row level security;

drop policy if exists op_renewals_owner on public.op_contract_renewals;
create policy op_renewals_owner on public.op_contract_renewals
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop trigger if exists trg_op_renewals_updated on public.op_contract_renewals;
create trigger trg_op_renewals_updated before update on public.op_contract_renewals
  for each row execute function public.op_set_updated_at();

create index if not exists idx_op_renewals_client on public.op_contract_renewals(client_id);
create index if not exists idx_op_renewals_owner on public.op_contract_renewals(owner_id);
create index if not exists idx_op_renewals_end on public.op_contract_renewals(contract_end);

-- ============================================================================
-- Views (estado derivado, calculadas em tempo real)
-- ============================================================================

-- Progresso de onboarding (4 integrações = 25% cada)
create or replace view public.op_onboarding_progress
with (security_invoker = on) as
select
  o.id,
  o.client_id,
  o.owner_id,
  o.status,
  (
    (case when o.meta_ads_connected then 1 else 0 end) +
    (case when o.google_ads_connected then 1 else 0 end) +
    (case when o.analytics_connected then 1 else 0 end) +
    (case when o.tag_manager_connected then 1 else 0 end)
  ) as steps_done,
  4 as steps_total,
  (
    (
      (case when o.meta_ads_connected then 1 else 0 end) +
      (case when o.google_ads_connected then 1 else 0 end) +
      (case when o.analytics_connected then 1 else 0 end) +
      (case when o.tag_manager_connected then 1 else 0 end)
    ) * 100 / 4
  ) as progress
from public.op_onboarding o;

grant select on public.op_onboarding_progress to authenticated;

-- Status calculado de renovações (sempre relativo a CURRENT_DATE)
create or replace view public.op_renewals_status
with (security_invoker = on) as
select
  r.id,
  r.client_id,
  r.owner_id,
  r.contract_start,
  r.contract_end,
  r.renewal_status,
  r.notes,
  r.created_at,
  r.updated_at,
  (r.contract_end - current_date) as days_to_expire,
  case
    when r.renewal_status = 'renovado'  then 'Renovado'
    when r.renewal_status = 'cancelado' then 'Cancelado'
    when r.contract_end <  current_date then 'Vencido'
    when r.contract_end <= current_date + 15 then 'Urgente'
    when r.contract_end <= current_date + 30 then 'Próximo Vencimento'
    else 'Ativo'
  end as computed_status
from public.op_contract_renewals r;

grant select on public.op_renewals_status to authenticated;

-- Dashboard executivo (1 linha, colunas tipadas) — escopo do usuário via RLS
create or replace view public.op_dashboard_exec_metrics
with (security_invoker = on) as
with
  cli as (
    select
      count(*)::int                                                as total_clientes,
      count(*) filter (where status = 'ativo')::int                as clientes_ativos,
      count(*) filter (where status <> 'ativo')::int               as clientes_inativos
    from public.op_clientes
  ),
  onb as (
    select
      count(*) filter (where status = 'pendente')::int             as onboarding_pendente,
      count(*) filter (where status = 'em_configuracao')::int      as onboarding_em_configuracao,
      count(*) filter (where status = 'concluido')::int            as onboarding_concluido
    from public.op_onboarding
  ),
  dep as (
    select
      count(*)::int                                                as deployments_total,
      count(*) filter (where status = 'concluido')::int            as deployments_concluidos,
      count(*) filter (where status = 'em_andamento')::int         as deployments_andamento
    from public.op_deployments
  ),
  cmp as (
    select
      count(*) filter (where status = 'ativa')::int                as campanhas_ativas,
      count(*) filter (where status = 'pausada')::int              as campanhas_pausadas,
      count(*) filter (where status = 'encerrada')::int            as campanhas_encerradas
    from public.op_campaigns
  ),
  itr as (
    select count(*)::int as interacoes_30d
    from public.op_client_interactions
    where interaction_date >= now() - interval '30 days'
  ),
  saude_so as (
    select count(*)::int as clientes_sem_onboarding
    from public.op_clientes c
    where not exists (select 1 from public.op_onboarding o where o.client_id = c.id)
  ),
  saude_sc as (
    select count(*)::int as clientes_sem_campanha_ativa
    from public.op_clientes c
    where not exists (
      select 1 from public.op_campaigns k where k.client_id = c.id and k.status = 'ativa'
    )
  ),
  saude_dp as (
    select count(distinct d.client_id)::int as clientes_com_implantacao_pendente
    from public.op_deployments d
    where d.status <> 'concluido'
  ),
  saude_cv as (
    select count(*)::int as contratos_vencendo_30d
    from public.op_contract_renewals r
    where r.renewal_status = 'ativo'
      and r.contract_end between current_date and current_date + 30
  )
select
  cli.total_clientes, cli.clientes_ativos, cli.clientes_inativos,
  onb.onboarding_pendente, onb.onboarding_em_configuracao, onb.onboarding_concluido,
  dep.deployments_total, dep.deployments_concluidos, dep.deployments_andamento,
  cmp.campanhas_ativas, cmp.campanhas_pausadas, cmp.campanhas_encerradas,
  itr.interacoes_30d,
  saude_so.clientes_sem_onboarding,
  saude_sc.clientes_sem_campanha_ativa,
  saude_dp.clientes_com_implantacao_pendente,
  saude_cv.contratos_vencendo_30d
from cli, onb, dep, cmp, itr, saude_so, saude_sc, saude_dp, saude_cv;

grant select on public.op_dashboard_exec_metrics to authenticated;