-- P1 — Metas configuráveis por organização (mensal/trimestral/anual/semanal)
-- Substitui as constantes hardcoded META_MENSAL e META_COMERCIAL em src/routes/bi.tsx.
-- Inclui metas operacionais semanais específicas da INFINDA (visitas, contatos, disparos,
-- vídeos, parcerias) que vão alimentar o Cockpit Operacional (Onda 5.5) depois.

create table if not exists public.bi_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_type text not null check (period_type in ('monthly','quarterly','yearly','weekly')),
  year int not null,
  month int,        -- 1-12 quando monthly
  quarter int,      -- 1-4 quando quarterly
  week int,         -- 1-53 quando weekly (ISO week); null = template default semanal

  -- comercial / receita
  revenue_goal numeric(14,2) default 0,
  contracts_goal int default 0,
  leads_goal int default 0,
  meetings_goal int default 0,
  proposals_goal int default 0,
  clients_goal int default 0,

  -- marketing / financeiro
  roas_goal numeric(6,2) default 0,
  cac_goal numeric(12,2) default 0,
  ltv_goal numeric(12,2) default 0,
  ticket_goal numeric(12,2) default 0,

  -- operacional INFINDA (semanais, e diários derivados)
  weekly_revenue_goal numeric(14,2) default 0,
  weekly_contracts_goal int default 0,
  weekly_visits_goal int default 0,         -- meta semanal (= diário × 5)
  weekly_contacts_goal int default 0,
  weekly_dispatches_goal int default 0,
  weekly_new_contacts_goal int default 0,
  weekly_companies_goal int default 0,
  weekly_videos_goal int default 0,
  weekly_partnerships_goal int default 0,
  daily_visits_goal int default 0,
  daily_contacts_goal int default 0,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_bi_goals_org_period
  on public.bi_goals (organization_id, period_type, year, coalesce(month,0), coalesce(quarter,0), coalesce(week,0));

grant select, insert, update, delete on public.bi_goals to authenticated;
grant all on public.bi_goals to service_role;

alter table public.bi_goals enable row level security;

drop policy if exists bi_goals_org_isolation on public.bi_goals;
create policy bi_goals_org_isolation on public.bi_goals
  for all to authenticated
  using  (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.bi_goals_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_bi_goals_touch on public.bi_goals;
create trigger trg_bi_goals_touch before update on public.bi_goals
  for each row execute function public.bi_goals_touch_updated_at();

-- ============================================================
-- Helper: lê meta efetiva (com fallback p/ valores default INFINDA)
-- ============================================================
create or replace function public.bi_get_goals(p_org uuid, p_year int default extract(year from now())::int, p_month int default extract(month from now())::int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_monthly bi_goals%rowtype;
  v_weekly  bi_goals%rowtype;
begin
  select * into v_monthly from public.bi_goals
   where organization_id = p_org and period_type = 'monthly' and year = p_year and month = p_month
   limit 1;

  select * into v_weekly from public.bi_goals
   where organization_id = p_org and period_type = 'weekly' and week is null and year = p_year
   order by created_at desc limit 1;

  return jsonb_build_object(
    'revenue_goal',          coalesce(v_monthly.revenue_goal, 68000),
    'contracts_goal',        coalesce(v_monthly.contracts_goal, 16),
    'leads_goal',            coalesce(v_monthly.leads_goal, 700),
    'meetings_goal',         coalesce(v_monthly.meetings_goal, 100),
    'proposals_goal',        coalesce(v_monthly.proposals_goal, 50),
    'clients_goal',          coalesce(v_monthly.clients_goal, 0),
    'roas_goal',             coalesce(v_monthly.roas_goal, 3),
    'cac_goal',              coalesce(v_monthly.cac_goal, 0),
    'ltv_goal',              coalesce(v_monthly.ltv_goal, 0),
    'ticket_goal',           coalesce(v_monthly.ticket_goal, 0),
    'weekly_revenue_goal',   coalesce(v_weekly.weekly_revenue_goal, 17000),
    'weekly_contracts_goal', coalesce(v_weekly.weekly_contracts_goal, 4),
    'weekly_visits_goal',    coalesce(v_weekly.weekly_visits_goal, 150),
    'weekly_contacts_goal',  coalesce(v_weekly.weekly_contacts_goal, 200),
    'weekly_dispatches_goal',coalesce(v_weekly.weekly_dispatches_goal, 240),
    'weekly_new_contacts_goal', coalesce(v_weekly.weekly_new_contacts_goal, 50),
    'weekly_companies_goal', coalesce(v_weekly.weekly_companies_goal, 180),
    'weekly_videos_goal',    coalesce(v_weekly.weekly_videos_goal, 2),
    'weekly_partnerships_goal', coalesce(v_weekly.weekly_partnerships_goal, 1),
    'daily_visits_goal',     coalesce(v_weekly.daily_visits_goal, 30),
    'daily_contacts_goal',   coalesce(v_weekly.daily_contacts_goal, 40)
  );
end $$;

grant execute on function public.bi_get_goals(uuid,int,int) to authenticated, service_role;

-- ============================================================
-- Seed: aplica metas INFINDA para todas as organizações existentes
-- ============================================================
insert into public.bi_goals (
  organization_id, period_type, year, month,
  revenue_goal, contracts_goal, leads_goal, meetings_goal, proposals_goal, ticket_goal, roas_goal
)
select id, 'monthly', extract(year from now())::int, extract(month from now())::int,
       68000, 16, 700, 100, 50, 4250, 3
  from public.organizations
on conflict do nothing;

insert into public.bi_goals (
  organization_id, period_type, year,
  weekly_revenue_goal, weekly_contracts_goal, weekly_visits_goal, weekly_contacts_goal,
  weekly_dispatches_goal, weekly_new_contacts_goal, weekly_companies_goal,
  weekly_videos_goal, weekly_partnerships_goal,
  daily_visits_goal, daily_contacts_goal
)
select id, 'weekly', extract(year from now())::int,
       17000, 4, 150, 200, 240, 50, 180, 2, 1, 30, 40
  from public.organizations
on conflict do nothing;