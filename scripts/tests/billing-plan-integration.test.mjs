// Teste de integração real: simula o fluxo do dialog "Gerar plano rápido"
// (src/routes/operacoes.clientes.$id.financeiro.tsx) contra o banco
// autenticado. Autentica um usuário de teste, gera os drafts com as MESMAS
// regras dos builders em src/lib/billing/api.ts (reimplementadas aqui para
// manter o teste puro-mjs), insere via RLS e verifica que as parcelas
// aparecem em client_billing_items com os totais/tipos/vencimentos certos.
//
// Roda com:  node --test scripts/tests/billing-plan-integration.test.mjs
//
// Env vars necessárias (o teste skipa se faltar alguma):
//   TEST_SUPABASE_URL             ex.: https://<ref>.supabase.co
//   TEST_SUPABASE_ANON_KEY        publishable/anon key
//   TEST_USER_EMAIL               usuário já cadastrado no Supabase Auth
//   TEST_USER_PASSWORD            senha do usuário
//   TEST_CLIENT_ID                UUID de um cliente acessível pela RLS
//                                 do usuário (mesma organização)

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

// ---------- Config / gating ----------

const ENV = {
  url: process.env.TEST_SUPABASE_URL,
  anon: process.env.TEST_SUPABASE_ANON_KEY,
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD,
  clientId: process.env.TEST_CLIENT_ID,
};

const missing = Object.entries(ENV).filter(([, v]) => !v).map(([k]) => k);
const SKIP = missing.length > 0;
const SKIP_REASON = SKIP
  ? `variáveis ausentes: ${missing.join(", ")}`
  : "";

// ---------- Reimplementação 1:1 dos builders ----------
// (fonte da verdade: src/lib/billing/api.ts — se mudar lá, quebra aqui)

function addDaysISO(baseISO, days) {
  const d = new Date(baseISO + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonthsISO(baseISO, months) {
  const d = new Date(baseISO + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function buildImplantacaoPlan({ clientId, valorTotal, parcelas, dataInicial, intervaloDias, descricaoBase }) {
  const each = Math.round((valorTotal / parcelas) * 100) / 100;
  const items = [];
  for (let i = 0; i < parcelas; i++) {
    const valor = i === parcelas - 1
      ? Math.round((valorTotal - each * (parcelas - 1)) * 100) / 100
      : each;
    items.push({
      client_id: clientId,
      descricao: `${descricaoBase} — ${i + 1}/${parcelas}`,
      tipo: "implantacao",
      valor,
      vencimento: addDaysISO(dataInicial, i * intervaloDias),
      status: "pendente",
      metodo: null,
      observacao: null,
      ordem: i,
    });
  }
  return items;
}

function buildMensalidadePlan({ clientId, valorMensal, meses, dataInicial, descricaoBase, bonificarPrimeirosMeses = 0 }) {
  const items = [];
  const bonif = bonificarPrimeirosMeses;
  for (let i = 0; i < meses; i++) {
    const isBonif = i < bonif;
    items.push({
      client_id: clientId,
      descricao: `${descricaoBase} — Mês ${i + 1}${isBonif ? " (bonificado)" : ""}`,
      tipo: "mensalidade",
      valor: isBonif ? 0 : valorMensal,
      vencimento: addMonthsISO(dataInicial, i),
      status: isBonif ? "bonificado" : "pendente",
      metodo: null,
      observacao: isBonif ? "Bonificação promocional" : null,
      ordem: 100 + i,
    });
  }
  return items;
}

// ---------- Setup Supabase autenticado + tag única ----------

// Todas as parcelas inseridas pelo teste levam esse marcador em `observacao`
// para que o cleanup remova SÓ o que o teste criou (mesmo se rodar em paralelo).
const RUN_TAG = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function tag(desc) {
  return `[${RUN_TAG}] ${desc}`;
}

async function makeAuthedClient() {
  const sb = createClient(ENV.url, ENV.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({
    email: ENV.email,
    password: ENV.password,
  });
  if (error) throw new Error(`Falha no login de teste: ${error.message}`);
  if (!data.session) throw new Error("Login retornou sem sessão");
  return sb;
}

async function cleanupTaggedRows(sb) {
  await sb
    .from("client_billing_items")
    .delete()
    .eq("client_id", ENV.clientId)
    .like("observacao", `%${RUN_TAG}%`);
}

// Aplica o tag em observacao para permitir cleanup determinístico.
function tagDrafts(drafts) {
  return drafts.map((d, i) => ({
    ...d,
    observacao: d.observacao ? `${d.observacao} ${tag("")}`.trim() : tag(`draft ${i}`),
  }));
}

// ---------- Testes ----------

test("[skipped] variáveis de ambiente ausentes", { skip: !SKIP }, () => {
  console.warn(`Integração pulada — ${SKIP_REASON}`);
});

test("cliente existe e é acessível pela RLS do usuário autenticado", { skip: SKIP }, async () => {
  const sb = await makeAuthedClient();
  try {
    const { data, error } = await sb
      .from("clients")
      .select("id")
      .eq("id", ENV.clientId)
      .maybeSingle();
    assert.equal(error, null, `erro RLS: ${error?.message}`);
    assert.ok(data, "TEST_CLIENT_ID não é visível ao usuário — RLS/org errada?");
  } finally {
    await sb.auth.signOut();
  }
});

test("single-implantacao: insere N parcelas com soma == valor total", { skip: SKIP }, async () => {
  const sb = await makeAuthedClient();
  try {
    const drafts = tagDrafts(
      buildImplantacaoPlan({
        clientId: ENV.clientId,
        valorTotal: 3000,
        parcelas: 3,
        dataInicial: "2099-01-15",
        intervaloDias: 30,
        descricaoBase: `IT ${RUN_TAG} implantação`,
      }),
    );
    assert.equal(drafts.length, 3, "builder deve gerar 3 parcelas");
    const somaBuilder = drafts.reduce((s, d) => s + d.valor, 0);
    assert.equal(Math.round(somaBuilder * 100) / 100, 3000, "soma do builder deve fechar em 3000");

    const { error: insErr } = await sb.from("client_billing_items").insert(drafts);
    assert.equal(insErr, null, `insert error: ${insErr?.message}`);

    const { data: rows, error: selErr } = await sb
      .from("client_billing_items")
      .select("*")
      .eq("client_id", ENV.clientId)
      .like("observacao", `%${RUN_TAG}%`)
      .order("ordem", { ascending: true });
    assert.equal(selErr, null, `select error: ${selErr?.message}`);
    assert.equal(rows.length, 3, "deve ler 3 linhas inseridas");

    // organization_id é preenchido pelo default do banco (current_org_id()).
    for (const r of rows) {
      assert.ok(r.organization_id, "organization_id deve ser preenchido pelo default");
      assert.equal(r.tipo, "implantacao");
      assert.equal(r.status, "pendente");
      assert.equal(r.client_id, ENV.clientId);
    }
    const soma = rows.reduce((s, r) => s + Number(r.valor), 0);
    assert.equal(Math.round(soma * 100) / 100, 3000, "soma do banco deve fechar em 3000");

    // Vencimentos: 15/01, 14/02, 16/03 (janela padrão de 30d)
    assert.equal(rows[0].vencimento, "2099-01-15");
    assert.equal(rows[1].vencimento, "2099-02-14");
    assert.equal(rows[2].vencimento, "2099-03-16");
  } finally {
    await cleanupTaggedRows(sb);
    await sb.auth.signOut();
  }
});

test("single-mensalidade com bonificação: parcelas bonificadas valem 0 e status = bonificado", { skip: SKIP }, async () => {
  const sb = await makeAuthedClient();
  try {
    const drafts = tagDrafts(
      buildMensalidadePlan({
        clientId: ENV.clientId,
        valorMensal: 500,
        meses: 4,
        dataInicial: "2099-06-10",
        descricaoBase: `IT ${RUN_TAG} mensalidade`,
        bonificarPrimeirosMeses: 2,
      }),
    );
    const { error: insErr } = await sb.from("client_billing_items").insert(drafts);
    assert.equal(insErr, null, `insert error: ${insErr?.message}`);

    const { data: rows, error: selErr } = await sb
      .from("client_billing_items")
      .select("*")
      .eq("client_id", ENV.clientId)
      .like("observacao", `%${RUN_TAG}%`)
      .order("ordem", { ascending: true });
    assert.equal(selErr, null, `select error: ${selErr?.message}`);
    assert.equal(rows.length, 4);

    const [m1, m2, m3, m4] = rows;
    assert.equal(Number(m1.valor), 0, "mês 1 bonificado deve valer 0");
    assert.equal(m1.status, "bonificado");
    assert.equal(Number(m2.valor), 0, "mês 2 bonificado deve valer 0");
    assert.equal(m2.status, "bonificado");
    assert.equal(Number(m3.valor), 500);
    assert.equal(m3.status, "pendente");
    assert.equal(Number(m4.valor), 500);
    assert.equal(m4.status, "pendente");

    assert.equal(m1.vencimento, "2099-06-10");
    assert.equal(m2.vencimento, "2099-07-10");
    assert.equal(m3.vencimento, "2099-08-10");
    assert.equal(m4.vencimento, "2099-09-10");

    // Regra financeira: total cobrado = (meses - bonif) * valorMensal
    const totalCobrado = rows
      .filter((r) => r.status !== "bonificado")
      .reduce((s, r) => s + Number(r.valor), 0);
    assert.equal(totalCobrado, 1000);
  } finally {
    await cleanupTaggedRows(sb);
    await sb.auth.signOut();
  }
});

test("preset-combinado (site + mentoria): insere ambos os tipos em uma única transação lógica", { skip: SKIP }, async () => {
  const sb = await makeAuthedClient();
  try {
    const site = buildImplantacaoPlan({
      clientId: ENV.clientId,
      valorTotal: 1200,
      parcelas: 2,
      dataInicial: "2099-02-01",
      intervaloDias: 30,
      descricaoBase: `IT ${RUN_TAG} site`,
    });
    const mentoria = buildMensalidadePlan({
      clientId: ENV.clientId,
      valorMensal: 300,
      meses: 3,
      dataInicial: "2099-02-01",
      descricaoBase: `IT ${RUN_TAG} mentoria`,
      bonificarPrimeirosMeses: 1,
    });
    const drafts = tagDrafts([...site, ...mentoria]);

    const { error: insErr } = await sb.from("client_billing_items").insert(drafts);
    assert.equal(insErr, null, `insert error: ${insErr?.message}`);

    const { data: rows } = await sb
      .from("client_billing_items")
      .select("tipo, status, valor")
      .eq("client_id", ENV.clientId)
      .like("observacao", `%${RUN_TAG}%`);

    const implRows = rows.filter((r) => r.tipo === "implantacao");
    const mensRows = rows.filter((r) => r.tipo === "mensalidade");
    assert.equal(implRows.length, 2, "2 parcelas de implantação (site)");
    assert.equal(mensRows.length, 3, "3 mensalidades (mentoria)");

    const totalSite = implRows.reduce((s, r) => s + Number(r.valor), 0);
    assert.equal(Math.round(totalSite * 100) / 100, 1200);

    const totalMent = mensRows
      .filter((r) => r.status !== "bonificado")
      .reduce((s, r) => s + Number(r.valor), 0);
    assert.equal(totalMent, 600, "mentoria cobrada = (3 - 1) * 300");

    const bonif = mensRows.filter((r) => r.status === "bonificado");
    assert.equal(bonif.length, 1);
    assert.equal(Number(bonif[0].valor), 0);
  } finally {
    await cleanupTaggedRows(sb);
    await sb.auth.signOut();
  }
});

test("RLS: usuário não consegue inserir para client_id de outra organização", { skip: SKIP }, async () => {
  const sb = await makeAuthedClient();
  try {
    const fakeClientId = "00000000-0000-0000-0000-000000000000";
    const draft = {
      client_id: fakeClientId,
      descricao: tag("rls-negative"),
      tipo: "avulso",
      valor: 1,
      vencimento: "2099-01-01",
      status: "pendente",
      metodo: null,
      observacao: tag("rls-negative"),
      ordem: 0,
    };
    const { error } = await sb.from("client_billing_items").insert([draft]);
    assert.ok(error, "insert deveria falhar por RLS/FK — a segurança está aberta demais?");
  } finally {
    await cleanupTaggedRows(sb);
    await sb.auth.signOut();
  }
});