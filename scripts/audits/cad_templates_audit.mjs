#!/usr/bin/env node
/**
 * Auditoria de conteúdo de public.cad_templates.
 * Uso: node scripts/audits/cad_templates_audit.mjs
 * Requer PG* no ambiente (mesmo padrão dos outros scripts).
 *
 * Regras (alinhadas ao docs/prospeccao/STYLE_GUIDE.md):
 *  - jargões proibidos
 *  - comprimento fora da faixa
 *  - mais de 1 emoji
 *  - falta de pergunta aberta em follow-ups
 *  - duplicação exata entre estágios do mesmo pack
 *  - abertura padronizada demais ("Só passando para reforçar…")
 */
import { execSync } from "node:child_process";

const BANNED = [
  /somos especialistas/i,
  /gostaria de apresentar/i,
  /oferta imperd[ií]vel/i,
  /última chance/i,
  /prezad[ao]/i,
  /só passando (para|pra) reforçar/i,
  /estamos entrando em contato para/i,
  /alavancar/i,
  /sinergia/i,
];

const OPEN_QUESTION_RE = /\?\s*$/m;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function words(s) {
  return (s || "").trim().split(/\s+/).filter(Boolean).length;
}

function rangeFor(stage) {
  if (stage === "followup_1") return [60, 120];
  if (stage.startsWith("followup_")) return [25, 100];
  return [10, 90];
}

function analyze(rows) {
  const findings = [];
  const byPack = new Map();
  for (const r of rows) {
    const list = byPack.get(r.pack_key) ?? [];
    list.push(r);
    byPack.set(r.pack_key, list);
  }

  for (const [pack, list] of byPack) {
    const seen = new Map();
    for (const r of list) {
      const body = r.corpo || "";
      const w = words(body);
      const [min, max] = rangeFor(r.stage);
      if (w < min || w > max) findings.push({ pack, stage: r.stage, kind: "length", detail: `${w} palavras (esperado ${min}-${max})` });

      const emojis = (body.match(EMOJI_RE) || []).length;
      if (emojis > 1) findings.push({ pack, stage: r.stage, kind: "emoji", detail: `${emojis} emojis` });

      for (const re of BANNED) {
        if (re.test(body)) findings.push({ pack, stage: r.stage, kind: "banned_phrase", detail: re.source });
      }

      if (r.stage.startsWith("followup_") && !OPEN_QUESTION_RE.test(body.trim()) && r.stage !== "followup_7") {
        findings.push({ pack, stage: r.stage, kind: "no_open_question", detail: "não termina com pergunta" });
      }

      const key = body.trim().slice(0, 120).toLowerCase();
      if (seen.has(key)) findings.push({ pack, stage: r.stage, kind: "duplicate_stage", detail: `igual a ${seen.get(key)}` });
      else seen.set(key, r.stage);
    }
  }
  return findings;
}

const sql = "SELECT pack_key, stage, corpo FROM cad_templates WHERE is_system = true ORDER BY pack_key, stage";
const out = execSync(`psql -A -F '\u001f' -t -c "${sql}"`, { encoding: "utf8" });
const rows = out.split("\n").filter(Boolean).map((line) => {
  const [pack_key, stage, ...rest] = line.split("\u001f");
  return { pack_key, stage, corpo: rest.join("\u001f") };
});

const findings = analyze(rows);
console.log(`Templates analisados: ${rows.length}`);
console.log(`Findings: ${findings.length}`);
const byKind = findings.reduce((acc, f) => { acc[f.kind] = (acc[f.kind] || 0) + 1; return acc; }, {});
console.table(byKind);
for (const f of findings.slice(0, 200)) {
  console.log(`- [${f.kind}] ${f.pack}/${f.stage}: ${f.detail}`);
}
if (findings.length > 200) console.log(`... (${findings.length - 200} findings adicionais omitidos)`);