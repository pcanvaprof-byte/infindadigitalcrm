-- ============================================================================
-- ISOLAMENTO POR USUÁRIO — FASE 2
-- Overlay de leitura via view + user-scoping em RPCs de cadência.
-- ============================================================================

-- 1) View v_prospects_user: prospects com operacional privado por usuário.
--    Se não há user_lead_state para (prospect, auth.uid()), devolve defaults.
create or replace view public.v_prospects_user
with (security_invoker = on) as
select
  p.id,
  p.organization_id,
  p.user_id,
  p.company,
  p.cnpj,
  p.segment,
  p.owner_name,
  p.whatsapp,
  p.phone,
  p.email,
  p.instagram,
  p.city,
  p.state,
  p.source,
  p.potential,
  p.created_at,
  p.updated_at,
  p.import_id,
  p.imported_by,
  p.imported_at,
  -- Operacional PRIVADO por usuário logado (overlay via user_lead_state).
  coalesce(uls.status,          'nao_contatado')  as status,
  coalesce(uls.cadence_step,    0)::smallint       as cadence_step,
  coalesce(uls.cadence_status,  'ativo')           as cadence_status,
  coalesce(uls.response_status, 'sem_resposta')    as response_status,
  uls.last_contact_at,
  uls.next_contact_at,
  uls.closed_at,
  uls.closed_reason,
  (uls.user_id is not null)                        as has_user_state
from public.prospects p
left join public.user_lead_state uls
  on uls.prospect_id = p.id
 and uls.user_id     = auth.uid();

grant select on public.v_prospects_user to authenticated;

-- 2) cad_dashboard_metrics: filtrar por owner_id/user_id para membros;
--    admin/owner mantém agregação org-wide.
create or replace function public.cad_dashboard_metrics()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_org   uuid    := public.current_org_id();
  v_uid   uuid    := auth.uid();
  v_admin boolean := public.current_org_role() in ('owner','admin');
  v_total int; v_by_stage jsonb; v_total_msgs int; v_total_resp int;
  v_total_fech int; v_taxa_resp numeric; v_taxa_conv numeric; v_serie jsonb;
begin
  select count(*) into v_total from public.cad_leads
   where organization_id = v_org and (v_admin or owner_id = v_uid);

  select coalesce(jsonb_object_agg(stage, c), '{}'::jsonb) into v_by_stage
  from (
    select stage::text as stage, count(*) c
      from public.cad_leads
     where organization_id = v_org and (v_admin or owner_id = v_uid)
     group by stage
  ) s;

  select count(*) into v_total_msgs
    from public.cad_messages m
   where m.organization_id = v_org
     and m.direction = 'out'
     and (v_admin or exists (
       select 1 from public.cad_leads l
        where l.id = m.lead_id and l.owner_id = v_uid
     ));

  select count(distinct m.lead_id) into v_total_resp
    from public.cad_messages m
   where m.organization_id = v_org
     and m.direction = 'in'
     and (v_admin or exists (
       select 1 from public.cad_leads l
        where l.id = m.lead_id and l.owner_id = v_uid
     ));

  select count(*) into v_total_fech
    from public.cad_leads
   where organization_id = v_org and stage = 'fechado'
     and (v_admin or owner_id = v_uid);

  v_taxa_resp := case when v_total > 0 then round(v_total_resp::numeric * 100 / v_total, 1) else 0 end;
  v_taxa_conv := case when v_total > 0 then round(v_total_fech::numeric * 100 / v_total, 1) else 0 end;

  select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'enviadas', enviadas, 'respostas', respostas) order by dia), '[]'::jsonb)
    into v_serie
  from (
    select d::date as dia,
      (select count(*) from public.cad_messages m
         where m.organization_id = v_org and m.direction='out' and m.created_at::date = d::date
           and (v_admin or exists (select 1 from public.cad_leads l where l.id=m.lead_id and l.owner_id=v_uid))
      ) as enviadas,
      (select count(*) from public.cad_messages m
         where m.organization_id = v_org and m.direction='in' and m.created_at::date = d::date
           and (v_admin or exists (select 1 from public.cad_leads l where l.id=m.lead_id and l.owner_id=v_uid))
      ) as respostas
    from generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') d
  ) s;

  return jsonb_build_object(
    'total', v_total, 'by_stage', v_by_stage,
    'taxa_resposta', v_taxa_resp, 'taxa_conversao', v_taxa_conv,
    'total_mensagens', v_total_msgs, 'serie_30d', v_serie,
    'scope', case when v_admin then 'org' else 'user' end
  );
end $function$;

-- 3) cad_metrics_serie_30d: idem — user-scoped para membro.
create or replace function public.cad_metrics_serie_30d()
returns table(dia date, enviadas bigint, respostas bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  with ctx as (
    select public.current_org_id() as org,
           auth.uid()               as uid,
           (public.current_org_role() in ('owner','admin')) as is_admin
  ),
  dias as (select (current_date - i)::date as dia from generate_series(0, 29) as i),
  agg as (
    select date_trunc('day', m.created_at)::date as dia,
           count(*) filter (where m.direction <> 'in') as enviadas,
           count(*) filter (where m.direction = 'in') as respostas
    from public.cad_messages m
    join ctx c on true
    left join public.cad_leads l on l.id = m.lead_id
    where m.created_at >= (current_date - interval '29 days')
      and m.organization_id = c.org
      and (c.is_admin or l.owner_id = c.uid)
    group by 1
  )
  select d.dia, coalesce(a.enviadas, 0), coalesce(a.respostas, 0)
  from dias d left join agg a using (dia) order by d.dia asc;
$function$;

-- 4) cadencia_followup_comparativo já filtra por auth.uid() (ok para membros).
--    Adiciona modo admin: quando admin, agrega toda a org.
create or replace function public.cadencia_followup_comparativo(_days integer default 14)
returns table(dia date, previstos integer, realizados integer, desvio integer, pct_aderencia numeric)
language sql
stable security definer
set search_path to 'public'
as $function$
  with ctx as (
    select auth.uid() as uid,
           (public.current_org_role() in ('owner','admin')) as is_admin,
           public.current_org_id() as org
  ),
  intervals as (
    select step, days from (values (1::smallint,1),(2::smallint,3),(3::smallint,7),(4::smallint,15),(5::smallint,21),(6::smallint,30)) v(step,days)
  ),
  t as (
    select pt.prospect_id, pt.enviado_em
      from public.prospect_touchpoints pt
      join public.prospects p on p.id = pt.prospect_id
      join ctx c on true
     where p.organization_id = c.org
       and (c.is_admin or pt.user_id = c.uid)
       and pt.resultado <> 'tentativa' and pt.tipo <> 'nota'
  ),
  t_ord as (
    select prospect_id, enviado_em,
      row_number() over (partition by prospect_id order by enviado_em)::smallint as rn,
      lead(enviado_em) over (partition by prospect_id order by enviado_em) as next_envio
    from t
  ),
  prev_hist as (
    select (t_ord.enviado_em + (i.days || ' days')::interval)::date as previsto_para
      from t_ord join intervals i on i.step = t_ord.rn where t_ord.next_envio is not null
  ),
  prev_fut as (
    select uls.next_contact_at::date as previsto_para
      from public.user_lead_state uls
      join public.prospects p on p.id = uls.prospect_id
      join ctx c on true
     where p.organization_id = c.org
       and (c.is_admin or uls.user_id = c.uid)
       and uls.cadence_status = 'ativo'
       and uls.next_contact_at is not null
       and uls.next_contact_at::date >= current_date
  ),
  prev_agg as (
    select previsto_para as dia, count(*)::int as previstos from (
      select previsto_para from prev_hist union all select previsto_para from prev_fut
    ) u group by previsto_para
  ),
  real_agg as (select enviado_em::date as dia, count(*)::int as realizados from t group by enviado_em::date),
  dias as (select (current_date - _days + g)::date as dia from generate_series(0, _days * 2) g)
  select d.dia,
    coalesce(p.previstos, 0), coalesce(r.realizados, 0),
    coalesce(r.realizados, 0) - coalesce(p.previstos, 0),
    case when coalesce(p.previstos, 0) = 0 then null else round(100.0 * coalesce(r.realizados, 0) / p.previstos, 1) end
  from dias d left join prev_agg p on p.dia = d.dia left join real_agg r on r.dia = d.dia order by d.dia;
$function$;

-- 5) Trigger de segurança: touchpoint sempre com user_id = auth.uid().
create or replace function public.prospect_touchpoints_force_user()
returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  new.user_id := auth.uid();
  return new;
end $$;

drop trigger if exists trg_prospect_touchpoints_force_user on public.prospect_touchpoints;
create trigger trg_prospect_touchpoints_force_user
  before insert on public.prospect_touchpoints
  for each row execute function public.prospect_touchpoints_force_user();

-- 6) acoes_hoje já filtra por prospects.user_id = auth.uid() (dono da lista).
--    Reescreve para usar user_lead_state, para funcionar mesmo em leads
--    compartilhados que o usuário adotou (uls existe) mas não é dono do prospect.
create or replace function public.acoes_hoje(_limit integer default 100)
returns table(id uuid, company text, whatsapp text, cadence_step smallint,
              last_contact_at timestamp with time zone, next_contact_at timestamp with time zone,
              dias_atraso integer)
language sql stable security definer set search_path='public'
as $function$
  select p.id, p.company, p.whatsapp, uls.cadence_step,
    uls.last_contact_at, uls.next_contact_at,
    case when uls.next_contact_at < now()
         then greatest(0, floor(extract(epoch from (now() - uls.next_contact_at))/86400)::int)
         else 0 end as dias_atraso
  from public.user_lead_state uls
  join public.prospects p on p.id = uls.prospect_id
  where uls.user_id = auth.uid()
    and uls.cadence_status = 'ativo'
    and uls.next_contact_at is not null
    and uls.next_contact_at <= (current_date + interval '1 day')
    and p.organization_id = public.current_org_id()
  order by uls.next_contact_at asc nulls last
  limit _limit;
$function$;

notify pgrst, 'reload schema';