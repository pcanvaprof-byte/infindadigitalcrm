-- =============================================================================
-- 20260750 — BI hotfix: clients.empresa não existe, usar clients.company
-- =============================================================================
-- A tabela public.clients foi criada com a coluna "company" (ver 20260623).
-- As RPCs bi_clients_perdidos() e bi_churn_risk() referenciam "empresa", o que
-- gera erro 42703 "column c.empresa does not exist" ao abrir /bi.
-- Este patch recria apenas as duas funções afetadas usando "company".
-- Idempotente. Não altera schema, apenas redefine RPCs.
-- =============================================================================

create or replace function public.bi_clients_perdidos()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then
    return jsonb_build_object('total',0,'valor_perdido',0,'recentes','[]'::jsonb);
  end if;

  select jsonb_build_object(
    'total', (select count(*) from public.clients
              where organization_id = v_org and pipeline_stage::text = 'perdido'),
    'valor_perdido', coalesce((select sum(coalesce(contract_value,0)) from public.clients
              where organization_id = v_org and pipeline_stage::text = 'perdido'), 0),
    'recentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'empresa', company,
        'valor', coalesce(contract_value,0), 'updated_at', updated_at
      ) order by updated_at desc)
      from (
        select id, company, contract_value, updated_at
          from public.clients
         where organization_id = v_org and pipeline_stage::text = 'perdido'
         order by updated_at desc limit 10
      ) s
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

create or replace function public.bi_churn_risk()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then
    return jsonb_build_object('alto',0,'medio',0,'baixo',0,'detalhes','[]'::jsonb);
  end if;

  with base as (
    select c.id, c.company as empresa,
           coalesce(c.contract_value,0) as valor,
           c.updated_at,
           extract(epoch from (now() - c.updated_at)) / 86400 as dias_sem_update
      from public.clients c
     where c.organization_id = v_org
       and c.pipeline_stage::text = 'ativo'
  ), scored as (
    select *,
      case when dias_sem_update > 60 then 'alto'
           when dias_sem_update > 30 then 'medio'
           else 'baixo' end as risco
      from base
  )
  select jsonb_build_object(
    'alto',  (select count(*) from scored where risco='alto'),
    'medio', (select count(*) from scored where risco='medio'),
    'baixo', (select count(*) from scored where risco='baixo'),
    'detalhes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,'empresa',empresa,'valor',valor,
        'dias_sem_update', round(dias_sem_update::numeric,0),
        'risco', risco
      ) order by dias_sem_update desc)
      from (select * from scored where risco in ('alto','medio')
            order by dias_sem_update desc limit 20) s
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

grant execute on function public.bi_clients_perdidos() to authenticated;
grant execute on function public.bi_churn_risk() to authenticated;

notify pgrst, 'reload schema';