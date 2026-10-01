-- ============================================================================
-- Cadência — isolar métricas por usuário quando Member.
--
-- Owner/Admin: métricas org-wide (comportamento anterior).
-- Member: apenas cad_leads/cad_messages cujo owner_id = auth.uid(),
-- para que o dashboard nunca revele volume/atividade de outros usuários.
-- ============================================================================

create or replace function public.cad_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_org  uuid := public.current_org_id();
  v_uid  uuid := auth.uid();
  v_role text := public.current_org_role();
  v_is_member boolean := (v_role = 'member');
  v_total int;
  v_by_stage jsonb;
  v_perdidos int;
  v_total_msgs int;
  v_total_resp int;
  v_total_fech int;
  v_taxa_resp numeric;
  v_taxa_conv numeric;
  v_serie jsonb;
begin
  select count(*) into v_total
    from public.cad_leads
    where organization_id = v_org
      and (not v_is_member or owner_id = v_uid);

  select coalesce(jsonb_object_agg(stage, c), '{}'::jsonb) into v_by_stage
  from (
    select stage::text as stage, count(*) c
    from public.cad_leads
    where organization_id = v_org
      and (not v_is_member or owner_id = v_uid)
    group by stage
  ) s;

  select count(*) into v_perdidos from public.cad_leads
    where organization_id = v_org and stage = 'perdido'
      and (not v_is_member or owner_id = v_uid);

  select count(*) into v_total_msgs from public.cad_messages
    where organization_id = v_org and direction = 'out'
      and (not v_is_member or lead_id in (select id from public.cad_leads where owner_id = v_uid));

  select count(distinct lead_id) into v_total_resp from public.cad_messages
    where organization_id = v_org and direction = 'in'
      and (not v_is_member or lead_id in (select id from public.cad_leads where owner_id = v_uid));

  select count(*) into v_total_fech from public.cad_leads
    where organization_id = v_org and stage = 'fechado'
      and (not v_is_member or owner_id = v_uid);

  v_taxa_resp := case when v_total > 0 then round(v_total_resp::numeric * 100 / v_total, 1) else 0 end;
  v_taxa_conv := case when v_total > 0 then round(v_total_fech::numeric * 100 / v_total, 1) else 0 end;

  select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'enviadas', enviadas, 'respostas', respostas) order by dia), '[]'::jsonb)
    into v_serie
  from (
    select d::date as dia,
      (select count(*) from public.cad_messages m
         where m.organization_id = v_org and m.direction='out'
           and (not v_is_member or m.lead_id in (select id from public.cad_leads where owner_id = v_uid))
           and m.created_at::date = d::date) as enviadas,
      (select count(*) from public.cad_messages m
         where m.organization_id = v_org and m.direction='in'
           and (not v_is_member or m.lead_id in (select id from public.cad_leads where owner_id = v_uid))
           and m.created_at::date = d::date) as respostas
    from generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') d
  ) s;

  return jsonb_build_object(
    'total', v_total,
    'by_stage', v_by_stage,
    'taxa_resposta', v_taxa_resp,
    'taxa_conversao', v_taxa_conv,
    'total_mensagens', v_total_msgs,
    'serie_30d', v_serie
  );
end $$;

grant execute on function public.cad_dashboard_metrics() to authenticated;

create or replace function public.cad_metrics_serie_30d()
returns table(dia date, enviadas bigint, respostas bigint)
language sql
stable
security definer
set search_path = public
as $$
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
      and (
        public.current_org_role() <> 'member'
        or m.lead_id in (select id from public.cad_leads where owner_id = auth.uid())
      )
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
