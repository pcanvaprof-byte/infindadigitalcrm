import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/lib/app-auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

function generateTempPassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*?";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: length - required.length }, () => pick(all));
  const out = [...required, ...rest];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

async function requireAdminOfSameOrg(
  supabase: AnyClient,
  targetOrgId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("current_org_role");
  if (error) throw new Error(error.message);
  const role = (data as string | null) ?? null;
  if (role !== "owner" && role !== "admin") {
    throw new Error("forbidden: apenas owner/admin podem executar esta operação.");
  }
  const { data: orgData, error: orgErr } = await supabase.rpc("current_org_id");
  if (orgErr) throw new Error(orgErr.message);
  if (orgData !== targetOrgId) {
    throw new Error("forbidden: alvo não pertence à sua organização.");
  }
}

export const getAccessStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    const { data, error } = await supabase.rpc("check_access_status");
    if (error) {
      // Fail-open enquanto a migração ainda não foi aplicada — a UI trata
      // como acesso ativo e não expira usuários por engano.
      return {
        status: "active" as const,
        access_type: "internal" as const,
        plan_name: null,
        expires_at: null,
        days_remaining: null,
        must_change_password: false,
        is_privileged: true,
      };
    }
    return data as {
      status: "active" | "expired" | "suspended";
      access_type: "trial" | "paid" | "internal" | null;
      plan_name: string | null;
      expires_at: string | null;
      days_remaining: number | null;
      must_change_password: boolean;
      is_privileged: boolean;
    };
  });

export const markPasswordChanged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
    const admin = createOwnSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (context as any).userId as string;

    const { data: row } = await (admin as AnyClient)
      .from("user_access")
      .select("id, organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (row?.id) {
      await (admin as AnyClient)
        .from("user_access")
        .update({ must_change_password: false })
        .eq("id", row.id);

      await (admin as AnyClient).from("user_access_events").insert({
        user_id: userId,
        organization_id: row.organization_id,
        event: "PASSWORD_CHANGED",
        meta: { at: new Date().toISOString() },
      });
    }
    return { ok: true };
  });

export const provisionMemberUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().trim().min(2).max(120),
        trialDays: z.number().int().min(1).max(365).optional().default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createOwnSupabaseAdminClient, resolveActiveOrg } = await import(
      "@/lib/api-keys.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callerSupabase = (context as any).supabase;
    const orgId = await resolveActiveOrg(callerSupabase);
    if (!orgId) throw new Error("Organização ativa não encontrada.");
    await requireAdminOfSameOrg(callerSupabase, orgId);

    const admin = createOwnSupabaseAdminClient();
    const email = data.email.trim().toLowerCase();

    // Idempotência: procura usuário existente por e-mail.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existingId: string | null = null;
    // Percorre páginas até achar ou esgotar (limite razoável).
    for (let page = 1; page <= 10; page++) {
      const { data: list, error: listErr } = await (admin as AnyClient).auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listErr) throw new Error(listErr.message);
      const users = list?.users ?? [];
      const found = users.find(
        (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email,
      );
      if (found) {
        existingId = found.id;
        break;
      }
      if (users.length < 200) break;
    }

    let userId = existingId;
    let tempPassword: string | null = null;
    let created = false;

    if (!userId) {
      tempPassword = generateTempPassword(12);
      const { data: createdUser, error: createErr } = await (
        admin as AnyClient
      ).auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (createErr || !createdUser?.user?.id) {
        throw new Error(createErr?.message ?? "Falha ao criar usuário.");
      }
      userId = createdUser.user.id;
      created = true;
    }

    // Membership + role (idempotentes).
    await (admin as AnyClient)
      .from("organization_members")
      .upsert(
        { organization_id: orgId, user_id: userId, role: "member" },
        { onConflict: "organization_id,user_id" },
      );

    await (admin as AnyClient)
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "member" },
        { onConflict: "user_id,role" },
      );

    // user_access — cria se não existir; se já existir, NÃO sobrescreve.
    const { data: existingAccess } = await (admin as AnyClient)
      .from("user_access")
      .select("id, expires_at, must_change_password")
      .eq("user_id", userId)
      .maybeSingle();

    const expiresAtIso = new Date(Date.now() + data.trialDays * 86400_000).toISOString();

    if (!existingAccess) {
      await (admin as AnyClient).from("user_access").insert({
        user_id: userId,
        organization_id: orgId,
        status: "active",
        access_type: "trial",
        expires_at: expiresAtIso,
        must_change_password: true,
      });
      await (admin as AnyClient).from("user_access_events").insert({
        user_id: userId,
        organization_id: orgId,
        event: "ACCESS_CREATED",
        meta: { trialDays: data.trialDays, expiresAt: expiresAtIso },
      });
    }

    return {
      created,
      userId,
      email,
      expiresAt: existingAccess?.expires_at ?? expiresAtIso,
      tempPassword, // null quando o usuário já existia
    };
  });

export const renewUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        days: z.number().int().min(1).max(3650),
        planName: z.string().trim().max(60).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createOwnSupabaseAdminClient, resolveActiveOrg } = await import(
      "@/lib/api-keys.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callerSupabase = (context as any).supabase;
    const orgId = await resolveActiveOrg(callerSupabase);
    if (!orgId) throw new Error("Organização ativa não encontrada.");
    await requireAdminOfSameOrg(callerSupabase, orgId);

    const admin = createOwnSupabaseAdminClient();

    const { data: current, error: readErr } = await (admin as AnyClient)
      .from("user_access")
      .select("id, expires_at, organization_id, plan_name")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Usuário sem registro de acesso.");
    if (current.organization_id !== orgId) {
      throw new Error("forbidden: usuário não pertence à sua organização.");
    }

    const now = new Date();
    const base =
      current.expires_at && new Date(current.expires_at) > now
        ? new Date(current.expires_at)
        : now;
    const newExpires = new Date(base.getTime() + data.days * 86400_000).toISOString();

    await (admin as AnyClient)
      .from("user_access")
      .update({
        status: "active",
        expires_at: newExpires,
        renewed_at: now.toISOString(),
        plan_name: data.planName ?? current.plan_name ?? null,
      })
      .eq("id", current.id);

    await (admin as AnyClient).from("user_access_events").insert({
      user_id: data.userId,
      organization_id: orgId,
      event: "ACCESS_RENEWED",
      meta: { days: data.days, planName: data.planName ?? null, newExpiresAt: newExpires },
    });

    return { ok: true, expiresAt: newExpires };
  });

export const resetMemberTempPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        requireChange: z.boolean().optional().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createOwnSupabaseAdminClient, resolveActiveOrg } = await import(
      "@/lib/api-keys.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callerSupabase = (context as any).supabase;
    const orgId = await resolveActiveOrg(callerSupabase);
    if (!orgId) throw new Error("Organização ativa não encontrada.");
    await requireAdminOfSameOrg(callerSupabase, orgId);

    const admin = createOwnSupabaseAdminClient();
    const email = data.email.trim().toLowerCase();

    // Localiza usuário por e-mail (mesma estratégia de provisionMemberUser).
    let userId: string | null = null;
    for (let page = 1; page <= 10; page++) {
      const { data: list, error: listErr } = await (admin as AnyClient).auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listErr) throw new Error(listErr.message);
      const users = list?.users ?? [];
      const found = users.find(
        (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email,
      );
      if (found) {
        userId = found.id;
        break;
      }
      if (users.length < 200) break;
    }
    if (!userId) throw new Error("Usuário não encontrado com esse e-mail.");

    // Garante que o usuário pertence à mesma organização do admin chamador.
    const { data: membership, error: memErr } = await (admin as AnyClient)
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!membership) {
      throw new Error("forbidden: usuário não pertence à sua organização.");
    }

    const tempPassword = generateTempPassword(12);
    const { error: updErr } = await (admin as AnyClient).auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (updErr) throw new Error(updErr.message);

    if (data.requireChange) {
      await (admin as AnyClient)
        .from("user_access")
        .update({ must_change_password: true })
        .eq("user_id", userId);
    }

    await (admin as AnyClient).from("user_access_events").insert({
      user_id: userId,
      organization_id: orgId,
      event: "PASSWORD_CHANGED",
      meta: {
        at: new Date().toISOString(),
        reason: "admin_reset_temp_password",
        requireChange: data.requireChange,
      },
    });

    return { ok: true, email, tempPassword };
  });