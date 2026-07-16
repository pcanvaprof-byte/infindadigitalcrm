// Regressão: garante que `user_lead_state` fica isolado por usuário.
// Simula dois usuários da mesma organização (admin e membro) escrevendo
// estado privado sobre o MESMO prospect e verifica que nenhum enxerga
// nem sobrescreve o registro do outro via RLS.
//
// Roda com:  node --test scripts/tests/user-lead-state-isolation.test.mjs
//
// Env necessárias (skipa se faltar):
//   TEST_SUPABASE_URL
//   TEST_SUPABASE_ANON_KEY
//   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD    — usuário admin da org
//   TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD  — usuário membro da MESMA org
//   TEST_PROSPECT_ID                          — prospect visível para ambos
//                                               (importado pelo admin p/ a org)

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const ENV = {
  url: process.env.TEST_SUPABASE_URL,
  anon: process.env.TEST_SUPABASE_ANON_KEY,
  adminEmail: process.env.TEST_ADMIN_EMAIL,
  adminPassword: process.env.TEST_ADMIN_PASSWORD,
  memberEmail: process.env.TEST_MEMBER_EMAIL,
  memberPassword: process.env.TEST_MEMBER_PASSWORD,
  prospectId: process.env.TEST_PROSPECT_ID,
};

const missing = Object.entries(ENV).filter(([, v]) => !v).map(([k]) => k);
const SKIP = missing.length > 0;
const SKIP_REASON = SKIP ? `variáveis ausentes: ${missing.join(", ")}` : "";

const RUN_TAG = `uls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signIn(email, password) {
  const sb = createClient(ENV.url, ENV.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  if (!data.session) throw new Error(`login ${email}: sem sessão`);
  return { sb, userId: data.user.id };
}

async function cleanup(sb) {
  await sb
    .from("user_lead_state")
    .delete()
    .eq("prospect_id", ENV.prospectId)
    .like("notes", `%${RUN_TAG}%`);
}

test("[skipped] variáveis de ambiente ausentes", { skip: !SKIP }, () => {
  console.warn(`Isolamento pulado — ${SKIP_REASON}`);
});

test(
  "ambos os usuários enxergam o mesmo prospect (dado compartilhado da org)",
  { skip: SKIP },
  async () => {
    const admin = await signIn(ENV.adminEmail, ENV.adminPassword);
    const member = await signIn(ENV.memberEmail, ENV.memberPassword);
    try {
      for (const [who, ctx] of [["admin", admin], ["member", member]]) {
        const { data, error } = await ctx.sb
          .from("prospects")
          .select("id, organization_id")
          .eq("id", ENV.prospectId)
          .maybeSingle();
        assert.equal(error, null, `${who} select prospect: ${error?.message}`);
        assert.ok(data, `${who} não enxerga o prospect — org errada?`);
      }
    } finally {
      await admin.sb.auth.signOut();
      await member.sb.auth.signOut();
    }
  },
);

test(
  "user_lead_state é privado: cada usuário só vê o próprio registro",
  { skip: SKIP },
  async () => {
    const admin = await signIn(ENV.adminEmail, ENV.adminPassword);
    const member = await signIn(ENV.memberEmail, ENV.memberPassword);
    try {
      assert.notEqual(admin.userId, member.userId, "usuários de teste devem ser distintos");

      // Descobre a org via prospect compartilhado (default RLS de insert).
      const { data: prospect, error: pErr } = await admin.sb
        .from("prospects")
        .select("organization_id")
        .eq("id", ENV.prospectId)
        .single();
      assert.equal(pErr, null, `load prospect: ${pErr?.message}`);
      const orgId = prospect.organization_id;

      // Cada usuário escreve seu próprio estado privado sobre o MESMO prospect.
      const adminRow = {
        prospect_id: ENV.prospectId,
        user_id: admin.userId,
        organization_id: orgId,
        status: "em_negociacao",
        cadence_step: 3,
        cadence_status: "ativa",
        response_status: "respondeu",
        notes: `admin ${RUN_TAG}`,
      };
      const memberRow = {
        prospect_id: ENV.prospectId,
        user_id: member.userId,
        organization_id: orgId,
        status: "nao_contatado",
        cadence_step: 0,
        cadence_status: "pendente",
        response_status: "sem_resposta",
        notes: `member ${RUN_TAG}`,
      };

      const { error: adminInsErr } = await admin.sb
        .from("user_lead_state")
        .upsert(adminRow, { onConflict: "prospect_id,user_id" });
      assert.equal(adminInsErr, null, `admin insert: ${adminInsErr?.message}`);

      const { error: memberInsErr } = await member.sb
        .from("user_lead_state")
        .upsert(memberRow, { onConflict: "prospect_id,user_id" });
      assert.equal(memberInsErr, null, `member insert: ${memberInsErr?.message}`);

      // 1) Admin só enxerga a própria linha para esse prospect.
      const { data: adminRows, error: adminSelErr } = await admin.sb
        .from("user_lead_state")
        .select("user_id, status, cadence_step, notes")
        .eq("prospect_id", ENV.prospectId);
      assert.equal(adminSelErr, null, `admin select: ${adminSelErr?.message}`);
      assert.equal(adminRows.length, 1, "admin deveria ver exatamente 1 linha (a sua)");
      assert.equal(adminRows[0].user_id, admin.userId);
      assert.equal(adminRows[0].status, "em_negociacao");
      assert.equal(adminRows[0].cadence_step, 3);

      // 2) Membro só enxerga a própria linha para esse prospect.
      const { data: memberRows, error: memberSelErr } = await member.sb
        .from("user_lead_state")
        .select("user_id, status, cadence_step, notes")
        .eq("prospect_id", ENV.prospectId);
      assert.equal(memberSelErr, null, `member select: ${memberSelErr?.message}`);
      assert.equal(memberRows.length, 1, "membro deveria ver exatamente 1 linha (a sua)");
      assert.equal(memberRows[0].user_id, member.userId);
      assert.equal(memberRows[0].status, "nao_contatado");
      assert.equal(memberRows[0].cadence_step, 0);

      // 3) Insert cruzado (member tentando gravar como admin) deve falhar via RLS.
      const { error: crossInsErr } = await member.sb
        .from("user_lead_state")
        .insert({
          prospect_id: ENV.prospectId,
          user_id: admin.userId, // tenta se passar pelo admin
          organization_id: orgId,
          status: "sabotado",
          cadence_step: 9,
          cadence_status: "ativa",
          response_status: "sem_resposta",
          notes: `cross ${RUN_TAG}`,
        });
      assert.ok(crossInsErr, "insert cruzado deveria ser rejeitado por RLS");

      // 4) Update cruzado (member tentando alterar linha do admin) não afeta nada.
      const { data: updated, error: crossUpdErr } = await member.sb
        .from("user_lead_state")
        .update({ status: "sabotado", notes: `sabot ${RUN_TAG}` })
        .eq("prospect_id", ENV.prospectId)
        .eq("user_id", admin.userId)
        .select();
      assert.equal(crossUpdErr, null, `member cross update erro: ${crossUpdErr?.message}`);
      assert.equal(updated?.length ?? 0, 0, "update cruzado não pode atingir linhas do outro usuário");

      // 5) Confirmação final: linha do admin permanece intacta.
      const { data: adminAfter } = await admin.sb
        .from("user_lead_state")
        .select("status, cadence_step, notes")
        .eq("prospect_id", ENV.prospectId)
        .eq("user_id", admin.userId)
        .single();
      assert.equal(adminAfter.status, "em_negociacao", "estado do admin não pode ter sido alterado pelo membro");
      assert.equal(adminAfter.cadence_step, 3);
      assert.ok(adminAfter.notes.includes(RUN_TAG));
    } finally {
      await cleanup(admin.sb);
      await cleanup(member.sb);
      await admin.sb.auth.signOut();
      await member.sb.auth.signOut();
    }
  },
);