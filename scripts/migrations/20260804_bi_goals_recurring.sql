-- P6 — Meta recorrente (MRR garantido) + meta de novos contratos
-- Modelo híbrido INFINDA: recorrência + novos negócios + expansão = meta total
-- NÃO destrutivo: adiciona coluna opcional e estende bi_get_goals.

alter table public.bi_goals
  add column if not exists recurring_revenue_goal numeric(14,2) default 10000;

-- Backfill: organizações sem valor recebem o padrão INFINDA de R$ 10.000.
update public.bi_goals
   set recurring_revenue_goal = 10000
 where recurring_revenue_goal is null
   and period_type = 'monthly';

-- Estende RPC para devolver também recurring_revenue_goal.
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
    'weekly_revenue_goal',    coalesce(v_weekly.weekly_revenue_goal, 17000),
    'weekly_contracts_goal',  coalesce(v_weekly.weekly_contracts_goal, 4),
    'weekly_visits_goal',     coalesce(v_weekly.weekly_visits_goal, 150),
    'weekly_contacts_goal',   coalesce(v_weekly.weekly_contacts_goal, 200),
    'weekly_dispatches_goal', coalesce(v_weekly.weekly_dispatches_goal, 240),
    'weekly_new_contacts_goal', coalesce(v_weekly.weekly_new_contacts_goal, 50),
    'weekly_companies_goal',  coalesce(v_weekly.weekly_companies_goal, 180),
    'weekly_videos_goal',     coalesce(v_weekly.weekly_videos_goal, 2),
    'weekly_partnerships_goal', coalesce(v_weekly.weekly_partnerships_goal, 1),
    'daily_visits_goal',      coalesce(v_weekly.daily_visits_goal, 30),
    'daily_contacts_goal',    coalesce(v_weekly.daily_contacts_goal, 40)
  );
end $$;

grant execute on function public.bi_get_goals(uuid,int,int) to authenticated, service_role;

-- RPC de upsert simples para a tela Metas & Objetivos.
create or replace function public.bi_set_monthly_goals(
  p_year int,
  p_month int,
  p_revenue numeric,
  p_recurring numeric,
  p_contracts int,
  p_leads int,
  p_meetings int,
  p_ticket numeric
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
    leads_goal, meetings_goal, ticket_goal
  )
  values (
    v_org, 'monthly', p_year, p_month,
    coalesce(p_revenue, 0), coalesce(p_recurring, 10000), coalesce(p_contracts, 0),
    coalesce(p_leads, 0), coalesce(p_meetings, 0), coalesce(p_ticket, 0)
  )
  on conflict (organization_id, period_type, year, coalesce(month,0), coalesce(quarter,0), coalesce(week,0))
  do update set
    revenue_goal           = excluded.revenue_goal,
    recurring_revenue_goal = excluded.recurring_revenue_goal,
    contracts_goal         = excluded.contracts_goal,
    leads_goal             = excluded.leads_goal,
    meetings_goal          = excluded.meetings_goal,
    ticket_goal            = excluded.ticket_goal,
    updated_at             = now();
end $$;

grant execute on function public.bi_set_monthly_goals(int,int,numeric,numeric,int,int,int,numeric) to authenticated, service_role;