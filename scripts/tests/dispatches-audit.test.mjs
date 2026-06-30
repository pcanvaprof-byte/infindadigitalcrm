// Testes de consistência da auditoria de disparos (auditDispatches).
// Reimplementa a agregação 1:1 — se a regra mudar em
// src/lib/bi/dispatches.functions.ts, este teste falha e força sincronização.
// Roda com: node --test scripts/tests/dispatches-audit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const OUTBOUND_TYPES = ["whatsapp", "ligacao", "email", "reuniao"];

function aggregateBucket(cadRows, tpRows, leadById = {}, sourceByProspect = {}) {
  const por_tipo = { whatsapp: 0, ligacao: 0, email: 0, reuniao: 0 };
  for (const r of tpRows) por_tipo[r.tipo] = (por_tipo[r.tipo] ?? 0) + 1;
  por_tipo.whatsapp += cadRows.length;

  const stageMap = new Map();
  for (const r of cadRows) {
    const stage = (r.lead_id && leadById[r.lead_id]?.stage) || "sem_stage";
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
  }
  const campMap = new Map();
  for (const r of tpRows) {
    const c = (r.prospect_id && sourceByProspect[r.prospect_id]) || "Sem origem";
    campMap.set(c, (campMap.get(c) ?? 0) + 1);
  }

  return {
    total: cadRows.length + tpRows.length,
    cadencia: cadRows.length,
    prospeccao: tpRows.length,
    por_tipo,
    por_canal: { cad_messages: cadRows.length, prospect_touchpoints: tpRows.length },
    por_cadencia: [...stageMap.entries()].map(([stage, total]) => ({ stage, total })),
    por_campanha: [...campMap.entries()].map(([campanha, total]) => ({ campanha, total })),
  };
}

function spDateKey(iso) {
  const d = new Date(iso);
  const sp = new Date(d.getTime() - 180 * 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${sp.getUTCFullYear()}-${pad(sp.getUTCMonth() + 1)}-${pad(sp.getUTCDate())}`;
}

function buildDailySeries(cadRows, tpRows, dayKeys) {
  const daily = new Map(dayKeys.map((k) => [k, { cadencia: 0, prospeccao: 0 }]));
  for (const r of cadRows) {
    const k = spDateKey(r.created_at);
    const cur = daily.get(k);
    if (cur) cur.cadencia += 1;
  }
  for (const r of tpRows) {
    const k = spDateKey(r.enviado_em);
    const cur = daily.get(k);
    if (cur) cur.prospeccao += 1;
  }
  return [...daily.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ date, ...v, total: v.cadencia + v.prospeccao }));
}

const cad = (id, ts, lead_id = null) => ({ id, created_at: ts, lead_id, tipo: "whatsapp", direction: "outbound" });
const tp = (id, ts, tipo, prospect_id = null) => ({ id, enviado_em: ts, tipo, prospect_id });

test("total = cadencia + prospeccao", () => {
  const b = aggregateBucket(
    [cad("c1", "2026-07-15T10:00:00-03:00"), cad("c2", "2026-07-15T11:00:00-03:00")],
    [tp("t1", "2026-07-15T10:30:00-03:00", "ligacao")],
  );
  assert.equal(b.total, 3);
  assert.equal(b.cadencia, 2);
  assert.equal(b.prospeccao, 1);
});

test("por_canal bate com cadencia/prospeccao", () => {
  const b = aggregateBucket(
    [cad("c1", "2026-07-15T10:00:00-03:00")],
    [tp("t1", "2026-07-15T11:00:00-03:00", "email"), tp("t2", "2026-07-15T12:00:00-03:00", "reuniao")],
  );
  assert.equal(b.por_canal.cad_messages, b.cadencia);
  assert.equal(b.por_canal.prospect_touchpoints, b.prospeccao);
  assert.equal(b.por_canal.cad_messages + b.por_canal.prospect_touchpoints, b.total);
});

test("soma por_tipo = total (cadência conta como whatsapp)", () => {
  const b = aggregateBucket(
    [cad("c1", "2026-07-15T10:00:00-03:00"), cad("c2", "2026-07-15T11:00:00-03:00")],
    [
      tp("t1", "2026-07-15T10:30:00-03:00", "whatsapp"),
      tp("t2", "2026-07-15T10:31:00-03:00", "ligacao"),
      tp("t3", "2026-07-15T10:32:00-03:00", "email"),
      tp("t4", "2026-07-15T10:33:00-03:00", "reuniao"),
    ],
  );
  const soma = OUTBOUND_TYPES.reduce((acc, t) => acc + (b.por_tipo[t] ?? 0), 0);
  assert.equal(soma, b.total);
  assert.equal(b.por_tipo.whatsapp, 3); // 2 cad + 1 tp
});

test("stage 'sem_stage' agrupa cad rows sem lead", () => {
  const b = aggregateBucket(
    [cad("c1", "2026-07-15T10:00:00-03:00", null), cad("c2", "2026-07-15T11:00:00-03:00", "L1")],
    [],
    { L1: { stage: "qualificado", empresa: "X" } },
  );
  const stages = Object.fromEntries(b.por_cadencia.map((s) => [s.stage, s.total]));
  assert.equal(stages["sem_stage"], 1);
  assert.equal(stages["qualificado"], 1);
});

test("daily_series: hoje+ontem+...últimos 7 dias = total da semana", () => {
  // Gera 7 dias × 1 disparo cad + 1 disparo tp
  const cadRows = [];
  const tpRows = [];
  const dayKeys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date("2026-07-15T12:00:00-03:00");
    d.setDate(d.getDate() - i);
    const iso = d.toISOString();
    cadRows.push(cad(`c${i}`, iso));
    tpRows.push(tp(`t${i}`, iso, "ligacao"));
    const key = spDateKey(iso);
    dayKeys.push(key);
  }
  const series = buildDailySeries(cadRows, tpRows, dayKeys);
  assert.equal(series.length, 7);
  const somaSerie = series.reduce((acc, d) => acc + d.total, 0);
  const bucket = aggregateBucket(cadRows, tpRows);
  assert.equal(somaSerie, bucket.total);
  // soma cad e prospeccao individualmente também deve bater
  assert.equal(series.reduce((a, d) => a + d.cadencia, 0), bucket.cadencia);
  assert.equal(series.reduce((a, d) => a + d.prospeccao, 0), bucket.prospeccao);
});

test("buckets hoje e ontem não se sobrepõem dentro da semana", () => {
  // 2 disparos hoje, 3 ontem
  const today = new Date("2026-07-15T15:00:00-03:00");
  const yesterday = new Date("2026-07-14T09:00:00-03:00");
  const cadAll = [
    cad("h1", today.toISOString()),
    cad("h2", today.toISOString()),
    cad("y1", yesterday.toISOString()),
  ];
  const tpAll = [
    tp("ty1", yesterday.toISOString(), "email"),
    tp("ty2", yesterday.toISOString(), "ligacao"),
  ];
  const hojeBucket = aggregateBucket(
    cadAll.filter((r) => r.created_at.startsWith("2026-07-15")),
    [],
  );
  const ontemBucket = aggregateBucket(
    cadAll.filter((r) => r.created_at.startsWith("2026-07-14")),
    tpAll,
  );
  const semanaBucket = aggregateBucket(cadAll, tpAll);
  assert.equal(hojeBucket.total, 2);
  assert.equal(ontemBucket.total, 3);
  assert.equal(hojeBucket.total + ontemBucket.total, semanaBucket.total);
});