-- P2 — Snapshots diários de KPIs do BI por organização.
-- Habilita comparativos MoM/WoW reais, sparklines, tendências e forecast
-- baseado em média móvel (em vez de extrapolação ingênua receita/dia).

create table if not exists public.bi_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_date date not null,

  revenue numeric(14,2) default 0,
  contracts int default 0,
  leads int default 0,
  meetings int default 0,
  proposals int default 0,
  clients_active int default 0,

  mrr numeric(14,2) default 0,
  arr numeric(14,2) default 0,
  ticket_medio numeric(12,2) default 0,
  cac numeric(12,2) default 0,
  ltv numeric(12,2) default 0,
  roas numeric(8,2) default 0,
  roi numeric(8,2) default 0,
  custo_marketing numeric(14,2) default 0,

  churn_alto int default 0,
  churn_medio int default 0,
  churn_baixo int default 0,
  pipeline_aberto numeric(14,2) default 0,

  infinda_score int,
  payload jsonb,            -- snapshot bruto do bi_dashboard p/ auditoria
  created_at timestamptz not null default now()
);

create unique index if not exists ux_bi_daily_snapshots_org_date
  on public.bi_daily_snapshots (organization_id, snapshot_date);

create index if not exists ix_bi_daily_snapshots_date
  on public.bi_daily_snapshots (snapshot_date desc);

grant select, insert, update, delete on public.bi_daily_snapshots to authenticated;
grant all on public.bi_daily_snapshots to service_role;

alter table public.bi_daily_snapshots enable row level security;

drop policy if exists bi_snapshots_org_isolation on public.bi_daily_snapshots;
create policy bi_snapshots_org_isolation on public.bi_daily_snapshots
  for all to authenticated
  using  (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ============================================================
-- bi_capture_snapshot: lê bi_dashboard de cada org e faz upsert.
-- Idempotente: pode ser chamado várias vezes no mesmo dia.
-- ============================================================
create or replace function public.bi_capture_snapshot(p_date date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_payload jsonb;
  v_kpis jsonb;
  v_forecast jsonb;
  v_churn jsonb;
  v_count int := 0;
  v_old_org uuid;
begin
  for r in select id from public.organizations loop
    begin
      -- força contexto para o bi_dashboard
      perform set_config('app.current_org_id', r.id::text, true);
      v_payload := public.bi_dashboard('diretoria');
    exception when others then
      v_payload := '{}'::jsonb;
    end;

    v_kpis     := coalesce(v_payload->'kpis', '{}'::jsonb);
    v_forecast := coalesce(v_payload->'forecast', '{}'::jsonb);
    v_churn    := coalesce(v_payload->'churn', '{}'::jsonb);

    insert into public.bi_daily_snapshots (
      organization_id, snapshot_date,
      revenue, clients_active, mrr, arr, ticket_medio, cac, ltv, roi, custo_marketing,
      churn_alto, churn_medio, churn_baixo, pipeline_aberto, payload
    ) values (
      r.id, p_date,
      coalesce((v_kpis->>'receita_realizada')::numeric, 0),
      coalesce((v_kpis->>'clientes_ativos')::int, 0),
      coalesce((v_kpis->>'mrr')::numeric, 0),
      coalesce((v_kpis->>'arr')::numeric, 0),
      coalesce((v_kpis->>'ticket_medio')::numeric, 0),
      coalesce((v_kpis->>'cac')::numeric, 0),
      coalesce((v_kpis->>'ltv')::numeric, 0),
      coalesce((v_kpis->>'roi')::numeric, 0),
      coalesce((v_kpis->>'custo_marketing')::numeric, 0),
      coalesce((v_churn->>'alto')::int, 0),
      coalesce((v_churn->>'medio')::int, 0),
      coalesce((v_churn->>'baixo')::int, 0),
      coalesce((v_forecast->>'pipeline_aberto')::numeric, 0),
      v_payload
    )
    on conflict (organization_id, snapshot_date) do update set
      revenue          = excluded.revenue,
      clients_active   = excluded.clients_active,
      mrr              = excluded.mrr,
      arr              = excluded.arr,
      ticket_medio     = excluded.ticket_medio,
      cac              = excluded.cac,
      ltv              = excluded.ltv,
      roi              = excluded.roi,
      custo_marketing  = excluded.custo_marketing,
      churn_alto       = excluded.churn_alto,
      churn_medio      = excluded.churn_medio,
      churn_baixo      = excluded.churn_baixo,
      pipeline_aberto  = excluded.pipeline_aberto,
      payload          = excluded.payload;

    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

grant execute on function public.bi_capture_snapshot(date) to authenticated, service_role;

-- ============================================================
-- bi_forecast_revenue: projeção via média móvel (7/15/30 dias úteis)
-- Substitui o cálculo ingênuo (realizado/dia × dias_totais) do bi.tsx.
-- ============================================================
create or replace function public.bi_forecast_revenue(p_org uuid, p_horizon_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_avg7  numeric;
  v_avg15 numeric;
  v_avg30 numeric;
  v_business_days int;
begin
  -- usa snapshots; ignora dias sem dado
  select coalesce(avg(daily_delta),0) into v_avg7  from (
    select greatest(revenue - lag(revenue) over (order by snapshot_date), 0) as daily_delta
      from public.bi_daily_snapshots
     where organization_id = p_org and snapshot_date >= current_date - 7
  ) s where daily_delta is not null;

  select coalesce(avg(daily_delta),0) into v_avg15 from (
    select greatest(revenue - lag(revenue) over (order by snapshot_date), 0) as daily_delta
      from public.bi_daily_snapshots
     where organization_id = p_org and snapshot_date >= current_date - 15
  ) s where daily_delta is not null;

  select coalesce(avg(daily_delta),0) into v_avg30 from (
    select greatest(revenue - lag(revenue) over (order by snapshot_date), 0) as daily_delta
      from public.bi_daily_snapshots
     where organization_id = p_org and snapshot_date >= current_date - 30
  ) s where daily_delta is not null;

  -- dias úteis no horizonte
  select count(*) into v_business_days
    from generate_series(current_date, current_date + p_horizon_days, '1 day') d
   where extract(dow from d) not in (0,6);

  return jsonb_build_object(
    'avg_daily_7',  round(v_avg7, 2),
    'avg_daily_15', round(v_avg15, 2),
    'avg_daily_30', round(v_avg30, 2),
    'business_days_ahead', v_business_days,
    'forecast_7',  round(v_avg7  * v_business_days, 2),
    'forecast_15', round(v_avg15 * v_business_days, 2),
    'forecast_30', round(v_avg30 * v_business_days, 2)
  );
end $$;

grant execute on function public.bi_forecast_revenue(uuid,int) to authenticated, service_role;

-- ============================================================
-- Backfill: dispara um snapshot inicial para hoje.
-- (Histórico real só virá quando o cron rodar diariamente.)
-- ============================================================
select public.bi_capture_snapshot(current_date);