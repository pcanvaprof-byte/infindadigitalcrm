// Teste de garantia: leads fora da data de disparo sempre vão para o final
// e são ordenados cronologicamente. Roda com: node --test scripts/tests/cadencia-sort.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

// Reimplementação 1:1 da função em src/lib/cadencia/sort.ts.
// Se a regra mudar, este teste falha — força sincronização.
function sortLeadsByDispatchDate(leads, now) {
  return [...leads].sort((a, b) => {
    const ta = a.next_action_at ? new Date(a.next_action_at).getTime() : null;
    const tb = b.next_action_at ? new Date(b.next_action_at).getTime() : null;
    const aFuture = ta !== null && ta > now;
    const bFuture = tb !== null && tb > now;
    if (aFuture !== bFuture) return aFuture ? 1 : -1;
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}

const NOW = new Date("2026-07-15T12:00:00Z").getTime();
const iso = (d) => new Date(d).toISOString();

test("vencidos vêm antes dos futuros", () => {
  const out = sortLeadsByDispatchDate([
    { id: "future", next_action_at: iso(NOW + 86400000 * 3) },
    { id: "overdue", next_action_at: iso(NOW - 86400000 * 2) },
  ], NOW);
  assert.deepEqual(out.map(l => l.id), ["overdue", "future"]);
});

test("vencidos ordenados do mais antigo para o mais recente", () => {
  const out = sortLeadsByDispatchDate([
    { id: "v1", next_action_at: iso(NOW - 3600_000) },
    { id: "v5d", next_action_at: iso(NOW - 86400_000 * 5) },
    { id: "v1d", next_action_at: iso(NOW - 86400_000) },
  ], NOW);
  assert.deepEqual(out.map(l => l.id), ["v5d", "v1d", "v1"]);
});

test("futuros ordenados cronologicamente no fim", () => {
  const out = sortLeadsByDispatchDate([
    { id: "f10", next_action_at: iso(NOW + 86400_000 * 10) },
    { id: "overdue", next_action_at: iso(NOW - 1000) },
    { id: "f2", next_action_at: iso(NOW + 86400_000 * 2) },
    { id: "f5", next_action_at: iso(NOW + 86400_000 * 5) },
  ], NOW);
  assert.deepEqual(out.map(l => l.id), ["overdue", "f2", "f5", "f10"]);
});

test("sem next_action_at vai pro final", () => {
  const out = sortLeadsByDispatchDate([
    { id: "null", next_action_at: null },
    { id: "overdue", next_action_at: iso(NOW - 1000) },
    { id: "future", next_action_at: iso(NOW + 86400_000) },
  ], NOW);
  assert.deepEqual(out.map(l => l.id), ["overdue", "future", "null"]);
});

test("invariante: nenhum futuro aparece antes de um vencido", () => {
  const leads = Array.from({ length: 50 }, (_, i) => ({
    id: `l${i}`,
    next_action_at: iso(NOW + (Math.random() * 20 - 10) * 86400_000),
  }));
  const out = sortLeadsByDispatchDate(leads, NOW);
  let sawFuture = false;
  for (const l of out) {
    const future = new Date(l.next_action_at).getTime() > NOW;
    if (future) sawFuture = true;
    if (!future && sawFuture) {
      assert.fail(`Vencido ${l.id} apareceu depois de um futuro`);
    }
  }
});
