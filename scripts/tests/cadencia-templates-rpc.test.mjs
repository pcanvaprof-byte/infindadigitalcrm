// Contrato de integração: RPC `cad_list_resolved_templates` e o
// fallback direto em `fetchResolvedTemplatesDirect` NÃO podem
// reintroduzir a regressão de `column reference "stage" is ambiguous`.
//
// Cobertura estática (lê os arquivos-fonte) porque o alvo é o
// contrato SQL + o fallback JS que a tela `/meus-templates` usa.
// Se alguém reescrever a RPC sem qualificar `stage`, ou remover o
// fallback direto e voltar a depender só da RPC crua, o teste
// quebra imediatamente.
//
// Roda com: node --test scripts/tests/cadencia-templates-rpc.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

const MIGRATION =
  "scripts/migrations/20260720_fix_cad_list_resolved_templates_ambiguous_stage.sql";
const API = "src/lib/cadencia/api.ts";

// -----------------------------------------------------------------
// 1. A migração corretiva existe e ainda declara a assinatura da RPC.
// -----------------------------------------------------------------
test("migração de correção da RPC existe com a assinatura esperada", () => {
  const sql = read(MIGRATION);
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION\s+public\.cad_list_resolved_templates\s*\(\s*p_organization_id\s+uuid\s*,\s*p_owner_id\s+uuid\s*,\s*p_pack_key\s+text\s*\)/i,
    "cad_list_resolved_templates(uuid, uuid, text) deve ser (re)criada",
  );
  assert.match(
    sql,
    /RETURNS\s+TABLE\s*\(\s*stage\s+public\.cad_stage\s*,\s*titulo\s+text\s*,\s*corpo\s+text\s*,\s*source\s+text\s*,\s*override_id\s+uuid\s*\)/i,
    "o RETURNS TABLE deve manter o contrato (stage, titulo, corpo, source, override_id)",
  );
  assert.match(
    sql,
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cad_list_resolved_templates\s*\(\s*uuid\s*,\s*uuid\s*,\s*text\s*\)\s+TO\s+authenticated/i,
    "a RPC deve manter GRANT EXECUTE para authenticated",
  );
});

// -----------------------------------------------------------------
// 2. Regressão da ambiguidade: a coluna `stage` do CTE precisa ter
//    nome próprio (`stage_value`) e o JOIN na tabela precisa ser
//    qualificado (`t.stage`). Nada de `PARTITION BY stage` ou
//    `JOIN ... ON stage = ...` cru.
// -----------------------------------------------------------------
test("RPC não pode reintroduzir referência ambígua a `stage`", () => {
  const sql = read(MIGRATION);

  // CTE com coluna renomeada para stage_value.
  assert.match(
    sql,
    /stage_list\s*\(\s*stage_value\s*,\s*stage_order\s*\)/i,
    "o CTE stage_list deve expor `stage_value` (não `stage`) para evitar colisão com cad_templates.stage",
  );

  // Uso de stage_value em PARTITION/ORDER/JOIN — nunca `stage` cru.
  assert.match(sql, /PARTITION\s+BY\s+sl\.stage_value/i, "PARTITION BY deve usar sl.stage_value");
  assert.match(sql, /ON\s+t\.stage\s*=\s*sl\.stage_value/i, "JOIN deve casar t.stage = sl.stage_value");

  // Proibições explícitas (regressões conhecidas).
  assert.doesNotMatch(
    sql,
    /PARTITION\s+BY\s+stage\b(?!_)/i,
    "PARTITION BY stage cru volta a produzir `column reference \"stage\" is ambiguous`",
  );
  assert.doesNotMatch(
    sql,
    /ORDER\s+BY\s+stage\b(?!_)/i,
    "ORDER BY stage cru também colide com cad_templates.stage — use sl.stage_value / c.stage_value",
  );
  assert.doesNotMatch(
    sql,
    /\bJOIN\s+public\.cad_templates\s+t\s+ON\s+stage\s*=/i,
    "JOIN não pode referenciar `stage` sem qualificar a tabela (t.stage)",
  );

  // O SELECT final projeta c.stage_value (não o nome cru `stage`),
  // preservando o contrato de saída da RETURNS TABLE.
  assert.match(
    sql,
    /SELECT\s+c\.stage_value\s*,/i,
    "o SELECT final deve projetar c.stage_value como primeira coluna",
  );
});

// -----------------------------------------------------------------
// 3. Todo qualificador `t.stage` no corpo do JOIN deve estar
//    qualificado com o alias da tabela (nunca `stage` isolado).
// -----------------------------------------------------------------
test("todas as referências ao `stage` da tabela cad_templates são qualificadas", () => {
  const sql = read(MIGRATION);
  // Remove comentários -- ... e string literals simples para não
  // gerar falso-positivo em texto livre.
  const stripped = sql
    .replace(/--[^\n]*\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Procura ocorrências de `stage` isoladas (sem prefixo alias.).
  // Aceita: t.stage, sl.stage_value, c.stage_value, override_stage,
  // stage_value, stage_order, "stage " dentro do RETURNS TABLE.
  const forbidden = /(?<![\w.])stage(?!_value|_order|_list|\s+public\.cad_stage|\s*text|\s+public\.)/gi;
  // Coleta apenas linhas dentro do bloco do WITH/SELECT (heurística:
  // depois de `RETURN QUERY` e antes do `END;`).
  const start = stripped.indexOf("RETURN QUERY");
  const end = stripped.indexOf("END;");
  assert.ok(start > 0 && end > start, "bloco RETURN QUERY ... END; deve existir");
  const body = stripped.slice(start, end);

  // Toda ocorrência de `stage` no corpo precisa estar prefixada
  // com um alias (t./sl./c./o.) ou fazer parte de override_stage.
  const offenders = [];
  for (const match of body.matchAll(forbidden)) {
    const idx = match.index ?? 0;
    const ctx = body.slice(Math.max(0, idx - 24), idx + 24);
    // permitido: override_stage, stage_value, stage_order (já filtrados),
    // e o alias `AS stage` do SELECT? Não usamos alias, então rejeita.
    if (/override_stage/.test(ctx)) continue;
    offenders.push(ctx.trim());
  }
  assert.equal(
    offenders.length,
    0,
    `Referências a \`stage\` sem alias no corpo da RPC:\n${offenders.join("\n")}`,
  );
});

// -----------------------------------------------------------------
// 4. O fallback direto continua ativo — `/meus-templates` NÃO pode
//    voltar a depender exclusivamente da RPC crua (foi justamente
//    o que quebrou a tela).
// -----------------------------------------------------------------
test("api.ts mantém fallback direto (fetchResolvedTemplatesDirect) para resolver templates", () => {
  const src = read(API);

  assert.match(
    src,
    /async function fetchResolvedTemplatesDirect\s*\(/,
    "fetchResolvedTemplatesDirect deve existir em src/lib/cadencia/api.ts",
  );
  assert.match(
    src,
    /export async function resolveTemplate[\s\S]{0,200}fetchResolvedTemplatesDirect\s*\(/,
    "resolveTemplate deve delegar para fetchResolvedTemplatesDirect",
  );
  assert.match(
    src,
    /export async function listResolvedTemplates[\s\S]{0,200}fetchResolvedTemplatesDirect\s*\(/,
    "listResolvedTemplates deve delegar para fetchResolvedTemplatesDirect",
  );
  assert.match(
    src,
    /export async function listMyTemplates[\s\S]{0,200}fetchResolvedTemplatesDirect\s*\(/,
    "listMyTemplates deve delegar para fetchResolvedTemplatesDirect (não pode voltar a chamar a RPC crua)",
  );

  // Nenhum dos três consumidores pode voltar a chamar
  // db.rpc("cad_list_resolved_templates", ...) diretamente enquanto
  // o fallback direto for o caminho oficial.
  assert.doesNotMatch(
    src,
    /db\.rpc\(\s*["']cad_list_resolved_templates["']/,
    "api.ts não pode chamar cad_list_resolved_templates diretamente — use fetchResolvedTemplatesDirect",
  );
});