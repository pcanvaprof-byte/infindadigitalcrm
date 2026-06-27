-- ============================================================================
-- Cadência — RPC de série dos últimos 30 dias (enviadas vs respostas).
--
-- Substitui o full-scan paginado em cad_messages feito no cliente.
-- Filtra por organização via current_org_id() (multi-tenant).
-- ============================================================================

create or replace function public.cad_metrics_serie_30d()
returns table(dia date, enviadas bigint, respostas bigint)
language sql stable security definer set search_path = public as $$
  with dias as (
    select (current_date - i)::date as dia
    from generate_series(0, 29) as i
  ),
  agg as (
    select
      date_trunc('day', m.created_at)::date as dia,
      count(*) filter (where m.direction <> 'in') as enviadas,
      count(*) filter (where m.direction = 'in') as respostas
    from public.cad_messages m
    where m.created_at >= (current_date - interval '29 days')
      and m.organization_id = public.current_org_id()
    group by 1
  )
  select d.dia,
         coalesce(a.enviadas, 0) as enviadas,
         coalesce(a.respostas, 0) as respostas
  from dias d
  left join agg a using (dia)
  order by d.dia asc;
$$;

grant execute on function public.cad_metrics_serie_30d() to authenticated;