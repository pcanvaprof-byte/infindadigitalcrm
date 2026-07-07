// Smoke test do RPC dashboard_metrics contra o Supabase externo
// (oxmhwwopxurwqcrwgsyf) após rodar as migrations consolidadas.
//
// Confirma que o RPC responde e traz as chaves novas de Fase 3:
//   contatos.novos, contatos.ultimos_7d, gargalos.parados_30d.
//
// Rodar com:
//   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
//     node --test scripts/tests/dashboard-smoke.test.mjs
//
// Envs opcionais (fallback pros defaults do projeto externo):
//   TEST_SUPABASE_URL   default https://oxmhwwopxurwqcrwgsyf.supabase.co
//   TEST_SUPABASE_ANON_KEY default = chave anon hard-coded em src/lib/app-auth-middleware.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL =
  process.env.TEST_SUPABASE_URL ||
  "https://oxmhwwopxurwqcrwgsyf.supabase.co";
const ANON =
  process.env.TEST_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bWh3d29weHVyd3Fjcndnc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzA2NjYsImV4cCI6MjA5NzEwNjY2Nn0.nAGtGeU-7YkzIjjCKJnfH5yeJ7LsQ-2s5ltMgHF7v88";
const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;

const SKIP = !EMAIL || !PASSWORD;
const SKIP_REASON = SKIP
  ? "TEST_USER_EMAIL e/ou TEST_USER_PASSWORD ausentes"
  : "";

test("dashboard_metrics responde com chaves esperadas", { skip: SKIP && SKIP_REASON }, async () => {
  const supabase = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  assert.equal(authErr, null, `login falhou: ${authErr?.message}`);

  const { data, error } = await supabase.rpc("dashboard_metrics");
  assert.equal(error, null, `RPC falhou: ${error?.message}`);
  assert.ok(data && typeof data === "object", "resposta vazia");

  // Chaves antigas
  assert.ok(data.contatos, "faltou bloco 'contatos'");
  assert.ok(data.respostas, "faltou bloco 'respostas'");
  assert.ok(data.resumo, "faltou bloco 'resumo'");
  assert.ok(data.gargalos, "faltou bloco 'gargalos'");
  assert.ok(data.pipeline, "faltou bloco 'pipeline'");
  assert.ok(data.conversao, "faltou bloco 'conversao'");

  // Chaves novas da Fase 3
  assert.equal(
    typeof data.contatos.ultimos_7d, "number",
    "contatos.ultimos_7d ausente ou não numérico — migration Fase 3 não aplicada",
  );
  assert.equal(
    typeof data.respostas.ultimos_7d, "number",
    "respostas.ultimos_7d ausente ou não numérico — migration Fase 3 não aplicada",
  );
  assert.equal(
    typeof data.resumo.novos, "number",
    "resumo.novos ausente ou não numérico — migration Fase 3 não aplicada",
  );
  assert.equal(
    typeof data.gargalos.parados_30d, "number",
    "gargalos.parados_30d ausente — migration Fase 3 não aplicada",
  );

  console.log("[smoke] KPIs:", {
    contatos_ultimos_7d: data.contatos.ultimos_7d,
    respostas_ultimos_7d: data.respostas.ultimos_7d,
    resumo_novos: data.resumo.novos,
    gargalos_parados_30d: data.gargalos.parados_30d,
    base: data.resumo.base,
    contatados: data.resumo.contatados,
  });
});
