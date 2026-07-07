// Contrato de integração: qualquer caminho de ENVIO de mensagem
// (openWhats na Prospecção, SendMessageDialog na Cadência e
// TouchpointModal) DEVE passar por `sanitizeTemplateForSend` antes
// do disparo/gravação. O destinatário nunca pode receber `{{...}}`.
//
// Este teste é estático (lê os arquivos-fonte) porque cobre um
// contrato de código, não um comportamento runtime — se alguém
// remover a sanitização ou reintroduzir substituições manuais em
// paralelo, o teste quebra imediatamente.
//
// Roda com: node --test scripts/tests/template-sanitize-integration.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

const PROSPECCAO = "src/routes/prospeccao.tsx";
const SEND_DIALOG = "src/components/cadencia/SendMessageDialog.tsx";
const TOUCHPOINT = "src/components/cadence/TouchpointModal.tsx";
const TYPES = "src/lib/cadencia/types.ts";

// -----------------------------------------------------------------
// 1. `sanitizeTemplateForSend` existe e é exportada.
// -----------------------------------------------------------------
test("sanitizeTemplateForSend é exportada em @/lib/cadencia/types", () => {
  const src = read(TYPES);
  assert.match(
    src,
    /export function sanitizeTemplateForSend\s*\(/,
    "sanitizeTemplateForSend deve existir e ser exportada",
  );
});

// -----------------------------------------------------------------
// 2. openWhats (prospeccao.tsx) sanitiza a mensagem final antes de
//    montar a URL do WhatsApp.
// -----------------------------------------------------------------
test("openWhats sanitiza mensagem antes de abrir o WhatsApp", () => {
  const src = read(PROSPECCAO);

  assert.match(
    src,
    /from\s+["']@\/lib\/cadencia\/types["'][^;]*sanitizeTemplateForSend/s,
    "prospeccao.tsx deve importar sanitizeTemplateForSend",
  );

  const openWhatsStart = src.indexOf("openWhats");
  assert.ok(openWhatsStart > 0, "função openWhats deve existir em prospeccao.tsx");
  // Pega o corpo aproximado de openWhats (até window.open)
  const windowOpenIdx = src.indexOf("window.open(url", openWhatsStart);
  assert.ok(windowOpenIdx > openWhatsStart, "window.open(url) deve existir em openWhats");
  const body = src.slice(openWhatsStart, windowOpenIdx);

  assert.match(
    body,
    /msg\s*=\s*sanitizeTemplateForSend\s*\(\s*msg\s*\)/,
    "openWhats deve reatribuir msg = sanitizeTemplateForSend(msg) antes de window.open",
  );

  const encodedIdx = src.indexOf("encodeURIComponent(msg)", openWhatsStart);
  const sanitizeIdx = src.indexOf("sanitizeTemplateForSend(msg)", openWhatsStart);
  assert.ok(
    sanitizeIdx > 0 && sanitizeIdx < encodedIdx,
    "sanitizeTemplateForSend(msg) deve rodar ANTES de encodeURIComponent(msg)",
  );
});

// -----------------------------------------------------------------
// 3. SendMessageDialog sanitiza antes de montar URL e de registrar.
// -----------------------------------------------------------------
test("SendMessageDialog sanitiza antes de buildSendUrl e registerSend", () => {
  const src = read(SEND_DIALOG);

  assert.match(
    src,
    /from\s+["']@\/lib\/cadencia\/types["'][^;]*sanitizeTemplateForSend/s,
    "SendMessageDialog deve importar sanitizeTemplateForSend",
  );

  const handleSendIdx = src.indexOf("async function handleSend");
  assert.ok(handleSendIdx > 0, "handleSend deve existir em SendMessageDialog");
  // Corpo de handleSend até o fechamento da função (heurística: próximo `function copy`)
  const endIdx = src.indexOf("function copy", handleSendIdx);
  const body = src.slice(handleSendIdx, endIdx > 0 ? endIdx : src.length);

  assert.match(
    body,
    /(?:const|let)\s+sendMsg\s*=\s*sanitizeTemplateForSend\s*\(\s*msg\s*\)/,
    "handleSend deve gerar sendMsg = sanitizeTemplateForSend(msg)",
  );
  assert.match(
    body,
    /buildSendUrl\s*\(\s*phone\s*,\s*sendMsg\s*,/,
    "buildSendUrl deve receber sendMsg (sanitizada), não o msg cru",
  );
  assert.match(
    body,
    /registerSend\s*\(\s*\{[^}]*mensagem\s*:\s*sendMsg/s,
    "registerSend deve gravar sendMsg (sanitizada), não o msg cru",
  );
  assert.doesNotMatch(
    body,
    /buildSendUrl\s*\(\s*phone\s*,\s*msg\s*,/,
    "buildSendUrl NÃO pode receber msg cru",
  );
  assert.doesNotMatch(
    body,
    /registerSend\s*\(\s*\{[^}]*mensagem\s*:\s*msg[\s,}]/s,
    "registerSend NÃO pode gravar msg cru",
  );
});

// -----------------------------------------------------------------
// 4. TouchpointModal sanitiza dentro do mutationFn (envio final).
// -----------------------------------------------------------------
test("TouchpointModal sanitiza no mutationFn antes de addTouchpoint", () => {
  const src = read(TOUCHPOINT);

  assert.match(
    src,
    /from\s+["']@\/lib\/cadencia\/types["'][^;]*sanitizeTemplateForSend/s,
    "TouchpointModal deve importar sanitizeTemplateForSend",
  );

  const mutIdx = src.indexOf("mutationFn");
  assert.ok(mutIdx > 0, "mutationFn deve existir em TouchpointModal");
  const addIdx = src.indexOf("addTouchpoint(", mutIdx);
  const body = src.slice(mutIdx, addIdx);

  assert.match(
    body,
    /sanitizeTemplateForSend\s*\(\s*mensagem\s*\)/,
    "mutationFn deve chamar sanitizeTemplateForSend(mensagem) antes de addTouchpoint",
  );
});

// -----------------------------------------------------------------
// 5. Não deve existir lógica paralela de sanitização (regex de
//    `{{...}}` manual) fora do módulo canônico.
// -----------------------------------------------------------------
test("nenhum caminho de envio faz replace manual de {{...}} (só o módulo canônico)", () => {
  const forbidden = /\.replace\s*\(\s*\/\\\{\\\{/; // .replace(/\{\{
  for (const path of [PROSPECCAO, SEND_DIALOG, TOUCHPOINT]) {
    const src = read(path);
    assert.doesNotMatch(
      src,
      forbidden,
      `${path} não pode ter .replace(/\\{\\{.../) manual — use sanitizeTemplateForSend`,
    );
  }
});
