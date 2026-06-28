-- Onda 2 (FINAL) — Bateria de testes do Dashboard
-- Rodar autenticado (auth.uid() definido) no SQL Editor.

-- 1) Schema e org corretos
select 'schema' as test, public.dashboard_metrics()->>'schema'  as got, 'v6' as expected;
select 'org_id' as test, public.dashboard_metrics()->>'org_id'  as got;

-- 2) Mutua-exclusividade e soma dos buckets
select public.dashboard_metrics_selftest();

-- 3) Guard de pipeline_stage
select public.assert_pipeline_stages_mapped(); -- void = ok

-- 4) Idempotência da conversão (não deve criar duplicata)
--    Substituir :pid pelo id de um prospect já convertido:
-- select * from public.convert_prospect_to_client(:pid);
-- select * from public.convert_prospect_to_client(:pid);  -- created=false

-- 5) Sem overlap em "Responderam" (dedupe por prospect)
with t as (
  select prospect_id
    from public.prospect_touchpoints
   where organization_id = (public.dashboard_metrics()->>'org_id')::uuid
     and (tipo::text='resposta' or resultado::text in ('respondido','interessado'))
)
select count(*) as respostas_brutas,
       count(distinct prospect_id) as respostas_unicas
  from t;

-- 6) EXPLAIN ANALYZE (performance)
explain (analyze, buffers, format text) select public.dashboard_metrics();