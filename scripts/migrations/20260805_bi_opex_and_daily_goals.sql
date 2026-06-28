-- P7 — Lucro real, painel "Hoje" e meta semanal
-- Adiciona custos operacionais (folha, infra, impostos) e completa metas
-- diárias/semanais utilizadas pelo Cockpit Executivo. Não destrutivo.

alter table public.bi_goals
  add column if not exists payroll_cost numeric(14,2) default 0,
  add column if not exists infra_cost   numeric(14,2) default 0,
  add column if not exists taxes_pct    numeric(5,2)  default 0,
  add column if not exists daily_visits_goal   int    default 30,
  add column if not exists daily_contacts_goal int    default 40,
  add column if not exists weekly_revenue_goal     numeric(14,2) default 17000,
  add column if not exists weekly_dispatches_goal  int           default 240;

-- Atualiza overload(uuid,int,int) para devolver os novos campos.
create or replace function public.bi_get_goals(
  p_org uuid,
  p_year int default extract(year from now())::int,
  p_month int default extract(month from now())::int
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
    'revenue_goal',           coalesce(v_monthly.revenue_goal, 68000),
    'recurring_revenue_goal', coalesce(v_monthly.recurring_revenue_goal, 10000),
    'contracts_goal',         coalesce(v_monthly.contracts_goal, 16),
    'leads_goal',             coalesce(v_monthly.leads_goal, 700),
    'meetings_goal',          coalesce(v_monthly.meetings_goal, 100),
    'proposals_goal',         coalesce(v_monthly.proposals_goal, 50),
    'clients_goal',           coalesce(v_monthly.clients_goal, 0),
    'roas_goal',              coalesce(v_monthly.roas_goal, 3),
    'cac_goal',               coalesce(v_monthly.cac_goal, 0),
    'ltv_goal',               coalesce(v_monthly.ltv_goal, 0),
    'ticket_goal',            coalesce(v_monthly.ticket_goal, 0),
    'payroll_cost',           coalesce(v_monthly.payroll_cost, 0),
    'infra_cost',             coalesce(v_monthly.infra_cost, 0),
    'taxes_pct',              coalesce(v_monthly.taxes_pct, 0),
    'weekly_revenue_goal',    coalesce(v_monthly.weekly_revenue_goal, v_weekly.weekly_revenue_goal, 17000),
    'weekly_contracts_goal',  coalesce(v_weekly.weekly_contracts_goal, 4),
    'weekly_visits_goal',     coalesce(v_weekly.weekly_visits_goal, 150),
    'weekly_contacts_goal',   coalesce(v_weekly.weekly_contacts_goal, 200),
    'weekly_dispatches_goal', coalesce(v_monthly.weekly_dispatches_goal, v_weekly.weekly_dispatches_goal, 240),
    'weekly_new_contacts_goal', coalesce(v_weekly.weekly_new_contacts_goal, 50),
    'weekly_companies_goal',  coalesce(v_weekly.weekly_companies_goal, 180),
    'weekly_videos_goal',     coalesce(v_weekly.weekly_videos_goal, 2),
    'weekly_partnerships_goal', coalesce(v_weekly.weekly_partnerships_goal, 1),
    'daily_visits_goal',      coalesce(v_monthly.daily_visits_goal, v_weekly.daily_visits_goal, 30),
    'daily_contacts_goal',    coalesce(v_monthly.daily_contacts_goal, v_weekly.daily_contacts_goal, 40)
  );
end $$;

grant execute on function public.bi_get_goals(uuid,int,int) to authenticated, service_role;

-- Overload sem org: infere via current_org_id(). Compatível com o frontend
-- que chama rpc('bi_get_goals', { p_year, p_month }).
create or replace function public.bi_get_goals(
  p_year int default extract(year from now())::int,
  p_month int default extract(month from now())::int
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public.current_org_id();
begin
  if v_org is null then return null; end if;
  return public.bi_get_goals(v_org, p_year, p_month);
end $$;

grant execute on function public.bi_get_goals(int,int) to authenticated, service_role;

-- Estende bi_set_monthly_goals para gravar custos e metas diárias/semanais.
create or replace function public.bi_set_monthly_goals(
  p_year int,
  p_month int,
  p_revenue numeric,
  p_recurring numeric,
  p_contracts int,
  p_leads int,
  p_meetings int,
  p_ticket numeric,
  p_payroll numeric default 0,
  p_infra numeric default 0,
  p_taxes_pct numeric default 0,
  p_weekly_revenue numeric default 17000,
  p_daily_visits int default 30,
  p_daily_contacts int default 40,
  p_weekly_dispatches int default 240
) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id();
begin
  if v_org is null then
    raise exception 'organization not resolved';
  end if;

  insert into public.bi_goals (
    organization_id, period_type, year, month,
    revenue_goal, recurring_revenue_goal, contracts_goal,
    leads_goal, meetings_goal, ticket_goal,
    payroll_cost, infra_cost, taxes_pct,
    weekly_revenue_goal, daily_visits_goal, daily_contacts_goal, weekly_dispatches_goal
  )
  values (
    v_org, 'monthly', p_year, p_month,
    coalesce(p_revenue, 0), coalesce(p_recurring, 10000), coalesce(p_contracts, 0),
    coalesce(p_leads, 0), coalesce(p_meetings, 0), coalesce(p_ticket, 0),
    coalesce(p_payroll, 0), coalesce(p_infra, 0), coalesce(p_taxes_pct, 0),
    coalesce(p_weekly_revenue, 17000), coalesce(p_daily_visits, 30),
    coalesce(p_daily_contacts, 40), coalesce(p_weekly_dispatches, 240)
  )
  on conflict (organization_id, period_type, year, coalesce(month,0), coalesce(quarter,0), coalesce(week,0))
  do update set
    revenue_goal           = excluded.revenue_goal,
    recurring_revenue_goal = excluded.recurring_revenue_goal,
    contracts_goal         = excluded.contracts_goal,
    leads_goal             = excluded.leads_goal,
    meetings_goal          = excluded.meetings_goal,
    ticket_goal            = excluded.ticket_goal,
    payroll_cost           = excluded.payroll_cost,
    infra_cost             = excluded.infra_cost,
    taxes_pct              = excluded.taxes_pct,
    weekly_revenue_goal    = excluded.weekly_revenue_goal,
    daily_visits_goal      = excluded.daily_visits_goal,
    daily_contacts_goal    = excluded.daily_contacts_goal,
    weekly_dispatches_goal = excluded.weekly_dispatches_goal,
    updated_at             = now();
end $$;

grant execute on function public.bi_set_monthly_goals(
  int,int,numeric,numeric,int,int,int,numeric,
  numeric,numeric,numeric,numeric,int,int,int
) to authenticated, service_role;

notify pgrst, 'reload schema';