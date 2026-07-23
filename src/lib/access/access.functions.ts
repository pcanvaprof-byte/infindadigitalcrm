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
      access_type: "trial" | "paid" | "internal" | "demo" | null;
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

export const listOrgUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createOwnSupabaseAdminClient, resolveActiveOrg } = await import(
      "@/lib/api-keys.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callerSupabase = (context as any).supabase;
    const orgId = await resolveActiveOrg(callerSupabase);
    if (!orgId) throw new Error("Organização ativa não encontrada.");
    await requireAdminOfSameOrg(callerSupabase, orgId);

    const admin = createOwnSupabaseAdminClient();

    // 1) Memberships da org.
    const { data: memberships, error: memErr } = await (admin as AnyClient)
      .from("organization_members")
      .select("user_id, role, joined_at")
      .eq("organization_id", orgId);
    if (memErr) throw new Error(memErr.message);

    const rows = (memberships ?? []) as Array<{
      user_id: string;
      role: string;
      joined_at: string;
    }>;
    if (rows.length === 0) return { users: [] as OrgUserRow[] };

    const userIds = rows.map((r) => r.user_id);

    // 2) user_access (1 por usuário — PK unique em user_id).
    const { data: accessRows } = await (admin as AnyClient)
      .from("user_access")
      .select(
        "user_id, status, access_type, plan_name, starts_at, expires_at, renewed_at, must_change_password, organization_id",
      )
      .in("user_id", userIds);

    const accessById = new Map<string, AnyClient>();
    for (const a of (accessRows ?? []) as Array<{ user_id: string }>) {
      accessById.set(a.user_id, a);
    }

    // 3) Último evento por usuário (best-effort, limitado).
    const { data: eventRows } = await (admin as AnyClient)
      .from("user_access_events")
      .select("user_id, event, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const lastEventById = new Map<string, { event: string; created_at: string }>();
    for (const e of (eventRows ?? []) as Array<{
      user_id: string;
      event: string;
      created_at: string;
    }>) {
      if (!lastEventById.has(e.user_id)) {
        lastEventById.set(e.user_id, { event: e.event, created_at: e.created_at });
      }
    }

    // 4) Enriquecer com dados do auth.users (email, nome, last_sign_in_at).
    // Percorre páginas até cobrir todos os usuários da lista.
    const authById = new Map<
      string,
      { email: string | null; full_name: string | null; last_sign_in_at: string | null; created_at: string | null }
    >();
    const needed = new Set(userIds);
    for (let page = 1; page <= 20 && needed.size > 0; page++) {
      const { data: list, error: listErr } = await (admin as AnyClient).auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listErr) throw new Error(listErr.message);
      const users = (list?.users ?? []) as Array<{
        id: string;
        email?: string | null;
        last_sign_in_at?: string | null;
        created_at?: string | null;
        user_metadata?: { full_name?: string | null } | null;
      }>;
      for (const u of users) {
        if (needed.has(u.id)) {
          authById.set(u.id, {
            email: u.email ?? null,
            full_name: u.user_metadata?.full_name ?? null,
            last_sign_in_at: u.last_sign_in_at ?? null,
            created_at: u.created_at ?? null,
          });
          needed.delete(u.id);
        }
      }
      if (users.length < 200) break;
    }

    const now = Date.now();
    const result: OrgUserRow[] = rows.map((m) => {
      const auth = authById.get(m.user_id) ?? {
        email: null,
        full_name: null,
        last_sign_in_at: null,
        created_at: null,
      };
      const a = accessById.get(m.user_id) as
        | {
            status: string;
            access_type: string;
            plan_name: string | null;
            starts_at: string | null;
            expires_at: string | null;
            renewed_at: string | null;
            must_change_password: boolean;
          }
        | undefined;

      let derived: OrgUserRow["derivedStatus"] = "sem_acesso";
      let daysRemaining: number | null = null;
      if (a) {
        if (a.status === "suspended") derived = "suspenso";
        else if (a.access_type === "internal") derived = "interno";
        else if (a.access_type === "paid") derived = "pago";
        else if (a.expires_at) {
          const ms = new Date(a.expires_at).getTime() - now;
          daysRemaining = Math.ceil(ms / 86400_000);
          if (ms <= 0) derived = "expirado";
          else if (a.access_type === "demo") derived = "demo";
          else derived = "trial";
        } else {
          derived = a.access_type === "demo" ? "demo" : "trial";
        }
      }

      const lastEvent = lastEventById.get(m.user_id) ?? null;

      return {
        userId: m.user_id,
        email: auth.email,
        fullName: auth.full_name,
        role: m.role as "owner" | "admin" | "member",
        joinedAt: m.joined_at,
        lastSignInAt: auth.last_sign_in_at,
        authCreatedAt: auth.created_at,
        access: a
          ? {
              status: a.status,
              accessType: a.access_type,
              planName: a.plan_name,
              startsAt: a.starts_at,
              expiresAt: a.expires_at,
              renewedAt: a.renewed_at,
              mustChangePassword: a.must_change_password,
            }
          : null,
        derivedStatus: derived,
        daysRemaining,
        lastEvent,
      };
    });

    // Ordena: owner > admin > member, depois por nome/email.
    const roleRank: Record<string, number> = { owner: 0, admin: 1, member: 2 };
    result.sort((a, b) => {
      const rr = (roleRank[a.role] ?? 3) - (roleRank[b.role] ?? 3);
      if (rr !== 0) return rr;
      const na = (a.fullName ?? a.email ?? "").toLowerCase();
      const nb = (b.fullName ?? b.email ?? "").toLowerCase();
      return na.localeCompare(nb);
    });

    return { users: result };
  });

export type OrgUserRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: "owner" | "admin" | "member";
  joinedAt: string | null;
  lastSignInAt: string | null;
  authCreatedAt: string | null;
  access: {
    status: string;
    accessType: string;
    planName: string | null;
    startsAt: string | null;
    expiresAt: string | null;
    renewedAt: string | null;
    mustChangePassword: boolean;
  } | null;
  derivedStatus:
    | "demo"
    | "trial"
    | "pago"
    | "interno"
    | "expirado"
    | "suspenso"
    | "sem_acesso";
  daysRemaining: number | null;
  lastEvent: { event: string; created_at: string } | null;
};