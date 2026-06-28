-- Auditoria de buckets do dashboard_metrics v4 por organização
-- Rode no SQL Editor após:
--   set local role authenticated;
--   set local "request.jwt.claims" = '{"sub":"<SEU_USER_ID>","role":"authenticated"}';

with org as (
  select public.current_org_id() as id
)
select
  'prospects (base)' as bucket,
  count(*)            as total
from public.prospects, org
where prospects.organization_id = org.id
union all
select 'touchpoints com source_ref (respondidos)',
       count(distinct pt.prospect_id)
from public.prospect_touchpoints pt, org
where pt.organization_id = org.id
  and pt.source_ref is not null
union all
select
  'clients.' || coalesce(pipeline_stage::text, 'NULL'),
  count(*)
from public.clients c, org
where c.organization_id = org.id
group by c.pipeline_stage
order by 1;