#!/usr/bin/env node
/**
 * EBD Linter — bloqueia violações do Event Boundary Document.
 *
 * Regras (docs/architecture/event-boundaries.md):
 *  1. INSERT em `proposal_events` SÓ via helper `logEvent` (src/lib/proposta/events).
 *     - Proibido em TS/TSX:  .from("proposal_events").insert(...)
 *  2. Views de BI NÃO podem referenciar `audit_logs`.
 *     - Em qualquer .sql contendo `create ... view ... as`, é proibido
 *       mencionar `audit_logs` no corpo da view.
 *  3. `aud_*` é prefixo exclusivo de auditoria — não pode aparecer em
 *     `proposal_events`/`log_evt` (payload de helper ou enum cliente).
 *
 * Saída: exit code != 0 derruba o build (wire em prebuild no package.json).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const violations = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".output" || name === ".tanstack") continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const HELPER_PATH = "src/lib/proposta/events/";

// Regra 1: qualquer mutação direta em proposal_events fora do helper.
// Cobre insert/upsert/update/delete + rpc("log_evt"/"log_aud") chamados de fora.
const directMutationRegex =
  /\.from\(\s*["'`]proposal_events["'`]\s*\)\s*\.(insert|upsert|update|delete)\b/;
const directRpcRegex =
  /\.rpc\(\s*["'`](log_evt|log_aud)["'`]/;
for (const f of files) {
  const ext = extname(f);
  if (![".ts", ".tsx", ".js", ".mjs"].includes(ext)) continue;
  const rel = relative(ROOT, f);
  if (rel.startsWith(HELPER_PATH)) continue;
  if (rel.startsWith("scripts/")) continue;
  const src = readFileSync(f, "utf8");
  if (directMutationRegex.test(src)) {
    violations.push(`[EBD-1] ${rel}: mutação direta em proposal_events (insert/upsert/update/delete). Use logEvent() de @/lib/proposta/events.`);
  }
  if (directRpcRegex.test(src)) {
    violations.push(`[EBD-1b] ${rel}: rpc("log_evt"/"log_aud") chamado fora do helper. Use logEvent() de @/lib/proposta/events.`);
  }
  // Regra 3 (TS): aud_ não pode aparecer em chamadas a logEvent / log_evt
  const audInEvt = /log_?[eE]vt[^)]*aud_/m;
  if (audInEvt.test(src)) {
    violations.push(`[EBD-3] ${rel}: prefixo aud_* não pode ser emitido por logEvent.`);
  }
}

// Regra 2: view de BI referenciando audit_logs
const viewRegex = /create\s+(or\s+replace\s+)?(materialized\s+)?view\s+([\w.]+)\s+as\s+([\s\S]*?);/gi;
for (const f of files) {
  if (extname(f) !== ".sql") continue;
  const rel = relative(ROOT, f);
  const src = readFileSync(f, "utf8");
  let m;
  while ((m = viewRegex.exec(src)) !== null) {
    const viewName = m[3];
    const body = m[4];
    if (/\baudit_logs\b/i.test(body)) {
      violations.push(`[EBD-2] ${rel}: view ${viewName} faz JOIN/SELECT em audit_logs. Views de BI não podem tocar auditoria.`);
    }
  }
}

if (violations.length > 0) {
  console.error("\n❌ EBD Linter encontrou violações:\n");
  for (const v of violations) console.error("  " + v);
  console.error(`\n${violations.length} violação(ões). Veja docs/architecture/event-boundaries.md\n`);
  process.exit(1);
}
console.log("✅ EBD Linter: nenhuma violação encontrada.");