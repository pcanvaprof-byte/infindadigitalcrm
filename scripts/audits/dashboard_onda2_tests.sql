-- ============================================================
-- Onda 2 — Suite de validacao (rode no SQL Editor autenticado)
--   set local role authenticated;
--   set local "request.jwt.claims" = '{"sub":"<USER_ID>","role":"authenticated"}';
--   \i dashboard_onda2_tests.sql
--
-- Todos os checks devem retornar PASS.
-- ============================================================

\set ON_ERROR_STOP on

-- T0: pipeline_stage 100% mapeado
select case when (select public.assert_pipeline_stages_mapped() is null)
            then 'T0 PASS' else 'T0 FAIL' end as t0_enum_guard;

-- T1: buckets do resumo sao mutuamente exclusivos e exaustivos
with m as (select public.dashboard_metrics() as j),
     r as (
       select (j->'resumo'->>'novos')::int          as novos,
              (j->'resumo'->>'interessados')::int   as interessados,
              (j->'resumo'->>'em_negociacao')::int  as em_negociacao,
              (j->'resumo'->>'ativos')::int         as ativos,
              (j->'resumo'->>'perdidos')::int       as perdidos,
              (j->>'org_id')::uuid                  as org_id
         from m
     ),
     c as (
       select count(*)::int as total from public.clients
        where organization_id = (select org_id from r)
     )
select case when (r.novos + r.interessados + r.em_negociacao + r.ativos + r.perdidos)
            = c.total then 'T1 PASS' else 'T1 FAIL' end as t1_buckets_exaustivos,
       r.*, c.total as clients_total
  from r, c;

-- T2: respostas_mes <= respondidos (mesmo conjunto deduplicado deve bater)
with m as (select public.dashboard_metrics() as j)
select case when (j->'respostas'->>'mes')::int <= (j->'resumo'->>'respondidos')::int
            then 'T2 PASS' else 'T2 FAIL' end as t2_respostas_dedupe
  from m;

-- T3: contatados <= base
with m as (select public.dashboard_metrics() as j)
select case when (j->'resumo'->>'contatados')::int <= (j->'resumo'->>'base')::int
            then 'T3 PASS' else 'T3 FAIL' end as t3_contatados_lt_base
  from m;

-- T4: source_ref preenchido em 100% dos clients vindos de prospect
with m as (select public.dashboard_metrics() as j),
     o as (select (m.j->>'org_id')::uuid as org_id from m)
select case when not exists (
         select 1 from public.clients c, o
          where c.organization_id = o.org_id
            and c.prospect_id is not null
            and c.source_ref is null
       ) then 'T4 PASS' else 'T4 FAIL' end as t4_source_ref_integro;

-- T5: unicidade prospect->cliente (1 cliente por prospect por org)
with m as (select public.dashboard_metrics() as j),
     o as (select (m.j->>'org_id')::uuid as org_id from m)
select case when not exists (
         select 1 from public.clients c, o
          where c.organization_id = o.org_id
            and c.source_ref is not null
          group by c.organization_id, c.source_ref
         having count(*) > 1
       ) then 'T5 PASS' else 'T5 FAIL' end as t5_um_cliente_por_prospect;

-- T6: consistencia entre usuarios da mesma org (dashboard nao depende de user_id)
--   Rode trocando o "sub" do JWT entre 2 usuarios da mesma org e compare:
--     select public.dashboard_metrics()->'resumo';
--   Os numeros devem ser identicos.

-- T7: duplicidade de touchpoints nao infla respostas
with m as (select public.dashboard_metrics() as j),
     o as (select (m.j->>'org_id')::uuid as org_id from m),
     raw as (
       select count(*) as n
         from public.prospect_touchpoints t, o
        where t.organization_id = o.org_id
          and (t.tipo::text = 'resposta'
               or t.resultado::text in ('respondido','interessado'))
     )
select case when (m.j->'resumo'->>'respondidos')::int <= raw.n
            then 'T7 PASS' else 'T7 FAIL' end as t7_respondidos_lt_raw
  from m, raw;

-- T8: idempotencia de convert_prospect_to_client
-- Rode com um prospect real da org:
--   select * from public.convert_prospect_to_client('<PROSPECT_ID>', 0, null);
--   select * from public.convert_prospect_to_client('<PROSPECT_ID>', 0, null);
-- A segunda chamada deve retornar created = false e o MESMO client_id.

-- T9: EXPLAIN ANALYZE
-- explain (analyze, buffers, format text) select public.dashboard_metrics();

-- T10: org sem prospects/clientes nao quebra
-- Crie uma org de teste, troque user_active_org e rode dashboard_metrics();
-- deve retornar base=0 sem erro.