-- ============================================================
-- Diff KPI a KPI: Onda 1 (v6 pós-20260743) x Onda 2 (pós-20260747)
-- Como usar:
--   1) ANTES de aplicar 20260747, rode o bloco SNAPSHOT abaixo.
--   2) DEPOIS de aplicar 20260747, rode o bloco DIFF.
--   Ambos precisam rodar autenticado (auth.uid() definido) e na
--   mesma organização ativa.
-- ============================================================

-- Tabela de snapshot (idempotente)
create table if not exists public._dashboard_metrics_snapshot (
  taken_at timestamptz not null default now(),
  label    text not null,
  org_id   uuid,
  payload  jsonb not null,
  primary key (label, org_id)
);

-- ---------- SNAPSHOT (rodar ANTES da 20260747) ----------
-- insert into public._dashboard_metrics_snapshot(label, org_id, payload)
-- select 'onda1', (public.dashboard_metrics()->>'org_id')::uuid, public.dashboard_metrics()
-- on conflict (label, org_id) do update set payload = excluded.payload, taken_at = now();

-- ---------- DIFF (rodar DEPOIS da 20260747) -------------
with
  before as (
    select payload as j
      from public._dashboard_metrics_snapshot
     where label = 'onda1'
     order by taken_at desc
     limit 1
  ),
  after as (select public.dashboard_metrics() as j),
  -- Achata o JSON em pares (path, valor) para comparar chave a chave.
  flat_before as (
    select path, value
      from before,
      lateral jsonb_each(jsonb_strip_nulls(j)) p1(k1, v1),
      lateral (
        select array[k1]::text[] as path, v1 as value
        union all
        select array[k1, k2]::text[], v2
          from jsonb_each(case when jsonb_typeof(v1)='object' then v1 else '{}'::jsonb end) p2(k2, v2)
      ) x
  ),
  flat_after as (
    select path, value
      from after,
      lateral jsonb_each(jsonb_strip_nulls(j)) p1(k1, v1),
      lateral (
        select array[k1]::text[] as path, v1 as value
        union all
        select array[k1, k2]::text[], v2
          from jsonb_each(case when jsonb_typeof(v1)='object' then v1 else '{}'::jsonb end) p2(k2, v2)
      ) x
  )
select
  coalesce(b.path, a.path)              as key_path,
  b.value                               as onda1,
  a.value                               as onda2,
  case
    when b.value is null              then 'ADDED'
    when a.value is null              then 'REMOVED'
    when b.value::text = a.value::text then 'EQUAL'
    else 'CHANGED'
  end                                   as status
from flat_before b
full outer join flat_after a using (path)
order by status, key_path;

-- Resumo (esperado: 100% EQUAL para v6 -> v6)
-- select status, count(*) from (...above query...) s group by status;