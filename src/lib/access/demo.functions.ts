import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const DEMO_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas
const DEMO_MAX_PER_IP_PER_DAY = 5;

function randomPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*?";
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

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function callerIp(): string | null {
  try {
    const req = getRequest();
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null;
  } catch {
    return null;
  }
}

/**
 * Chamada após login social (Google). Provisiona — de forma idempotente —
 * a organização real (vazia) do usuário e concede acesso demo por 2 horas
 * caso ele ainda não tenha `user_access`. Se já for membro/tiver acesso,
 * apenas retorna o status atual sem alterar nada.
 */
export const claimDemoAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const authUser = (context.claims ?? {}) as {
      email?: string;
      user_metadata?: { full_name?: string; name?: string };
    };
    const email =
      authUser.email ??
      (context as unknown as { user?: { email?: string } }).user?.email ??
      "";
    const fullName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      (email ? email.split("@")[0] : "Usuário");

    const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
    const admin = createOwnSupabaseAdminClient() as AnyClient;

    // Se já existe acesso, não fazemos nada — usuário reincidente.
    const { data: existingAccess } = await admin
      .from("user_access")
      .select("id, status, access_type, expires_at, organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingAccess?.id) {
      return {
        alreadyProvisioned: true,
        email,
        organizationId: existingAccess.organization_id as string | null,
        expiresAt: existingAccess.expires_at as string | null,
        accessType: existingAccess.access_type as string | null,
      };
    }

    // Rate limit por IP.
    const ip = callerIp();
    try {
      if (ip) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await admin
          .from("demo_signups_log")
          .select("id", { count: "exact", head: true })
          .eq("ip", ip)
          .gte("created_at", since);
        if ((count ?? 0) >= DEMO_MAX_PER_IP_PER_DAY) {
          throw new Error(
            "Limite de demos atingido para este IP. Tente novamente amanhã.",
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Limite")) throw err;
      // tabela inexistente — segue sem bloquear.
    }

    // Cria organização real (vazia) para o usuário.
    const suffix = shortId();
    const orgName = fullName.split(" ")[0]
      ? `${fullName.split(" ")[0]}'s workspace`
      : "Meu workspace";
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name: orgName,
        slug: `demo-${suffix}-${Date.now().toString(36)}`,
        created_by: userId,
      })
      .select("id")
      .single();
    if (orgErr || !org?.id) {
      throw new Error(orgErr?.message ?? "Falha ao criar organização.");
    }
    const orgId = org.id as string;

    // Atualiza full_name no auth se ainda não estiver setado.
    try {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: fullName },
      });
    } catch { /* noop */ }

    // Membership owner + role admin.
    try {
      await admin.from("organization_members").upsert(
        { organization_id: orgId, user_id: userId, role: "owner" },
        { onConflict: "organization_id,user_id" },
      );
    } catch { /* noop */ }
    try {
      await admin.from("user_roles").upsert(
        { user_id: userId, role: "admin" },
        { onConflict: "user_id,role" },
      );
    } catch { /* noop */ }

    // Organização ativa.
    try {
      await admin.from("user_active_org").upsert(
        {
          user_id: userId,
          organization_id: orgId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    } catch { /* noop */ }

    // Acesso demo com expiração de 2h.
    const expiresAt = new Date(Date.now() + DEMO_DURATION_MS).toISOString();
    const { error: accessErr } = await admin.from("user_access").insert({
      user_id: userId,
      organization_id: orgId,
      status: "active",
      access_type: "demo",
      expires_at: expiresAt,
      must_change_password: false,
    });
    if (accessErr) {
      throw new Error(accessErr.message ?? "Falha ao criar acesso demo.");
    }
    try {
      await admin.from("user_access_events").insert({
        user_id: userId,
        organization_id: orgId,
        event: "ACCESS_CREATED",
        meta: {
          access_type: "demo",
          via: "google_oauth",
          duration_hours: 2,
          expires_at: expiresAt,
          email,
        },
      });
    } catch { /* noop */ }
    try {
      await admin.from("demo_signups_log").insert({ ip, organization_id: orgId });
    } catch { /* noop */ }

    return {
      alreadyProvisioned: false,
      email,
      organizationId: orgId,
      expiresAt,
      accessType: "demo" as const,
    };
  });

export const startDemo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(80).optional(),
        email: z.string().trim().email().max(160).optional(),
        password: z.string().min(8).max(72).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
    const admin = createOwnSupabaseAdminClient() as AnyClient;

    // 1) Rate limit por IP (5/dia). Falha-aberta se a tabela não existir.
    const ip = callerIp();
    try {
      if (ip) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await admin
          .from("demo_signups_log")
          .select("id", { count: "exact", head: true })
          .eq("ip", ip)
          .gte("created_at", since);
        if ((count ?? 0) >= DEMO_MAX_PER_IP_PER_DAY) {
          throw new Error(
            "Limite de demos atingido para este IP. Tente novamente amanhã.",
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Limite")) throw err;
      // demo_signups_log inexistente ou indisponível — segue sem bloquear.
    }

    // 2) Cria usuário demo.
    const suffix = shortId();
    const requestedEmail = data.email?.trim().toLowerCase();
    const email =
      requestedEmail && requestedEmail.length > 0
        ? requestedEmail
        : `demo-${Date.now().toString(36)}-${suffix}@demo.infinda.local`;
    const password = data.password && data.password.length >= 8
      ? data.password
      : randomPassword(14);
    const fullName = data.fullName?.trim() || "Usuário Demo";

    // Se o email real já existe, não recria — devolve orientação de login.
    if (requestedEmail) {
      try {
        for (let page = 1; page <= 10; page++) {
          const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const users = list?.users ?? [];
          const found = users.find(
            (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === requestedEmail,
          );
          if (found) {
            throw new Error(
              "Este email já tem conta na Infinda. Faça login com sua senha ou peça reset ao admin.",
            );
          }
          if (users.length < 200) break;
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Este email")) throw err;
        // listUsers falhou — segue e deixa o createUser reclamar duplicidade.
      }
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, is_demo: true },
    });
    if (createErr || !created?.user?.id) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário demo.");
    }
    const userId = created.user.id as string;

    // 3) Cria organização demo.
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name: `Demo ${suffix}`,
        slug: `demo-${suffix}-${Date.now().toString(36)}`,
        created_by: userId,
      })
      .select("id")
      .single();
    if (orgErr || !org?.id) {
      // Rollback do usuário para evitar lixo órfão.
      try { await admin.auth.admin.deleteUser(userId); } catch { /* noop */ }
      throw new Error(orgErr?.message ?? "Falha ao criar organização demo.");
    }
    const orgId = org.id as string;

    // 4) Membership (owner) + role admin.
    try {
      await admin
        .from("organization_members")
        .upsert(
          { organization_id: orgId, user_id: userId, role: "owner" },
          { onConflict: "organization_id,user_id" },
        );
    } catch { /* noop */ }
    try {
      await admin
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "admin" },
          { onConflict: "user_id,role" },
        );
    } catch { /* noop */ }

    // 5) user_active_org (para current_org_id resolver corretamente).
    try {
      await admin
        .from("user_active_org")
        .upsert(
          { user_id: userId, organization_id: orgId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
    } catch { /* noop */ }

    // 6) user_access com expiração de 2h e access_type='demo'.
    const expiresAt = new Date(Date.now() + DEMO_DURATION_MS).toISOString();
    try {
      await admin.from("user_access").insert({
        user_id: userId,
        organization_id: orgId,
        status: "active",
        access_type: "demo",
        expires_at: expiresAt,
        must_change_password: false,
      });
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("Falha ao criar acesso demo.");
    }
    try {
      await admin.from("user_access_events").insert({
        user_id: userId,
        organization_id: orgId,
        event: "ACCESS_CREATED",
        meta: { access_type: "demo", duration_hours: 2, expires_at: expiresAt },
      });
    } catch { /* noop */ }

    // 7) Seed de dados fictícios (idempotente, não bloqueia login se falhar).
    try {
      const { seedDemoOrganization } = await import("./demo.seed.server");
      await seedDemoOrganization({
        admin,
        organizationId: orgId,
        userId,
        fullName,
      });
    } catch { /* noop */ }

    // 8) Log anti-abuso.
    try {
      await admin
        .from("demo_signups_log")
        .insert({ ip, organization_id: orgId });
    } catch { /* noop */ }

    return {
      email,
      password,
      expiresAt,
      organizationId: orgId,
    };
  });

/**
 * Converte a organização demo do usuário atual em uma organização real (paga).
 * Todos os dados criados durante a demonstração são preservados.
 * Idempotente: se já não é mais demo, retorna o status atual sem alterações.
 */
export const convertDemoToPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
    const admin = createOwnSupabaseAdminClient() as AnyClient;

    const { data: access } = await admin
      .from("user_access")
      .select("id, access_type, organization_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!access?.id) {
      throw new Error("Nenhum acesso encontrado para este usuário.");
    }

    const orgId = access.organization_id as string | null;
    if (access.access_type !== "demo") {
      return { alreadyConverted: true, organizationId: orgId };
    }

    // 1) Atualiza acesso: paid, sem expiração, ativo.
    const { error: accessErr } = await admin
      .from("user_access")
      .update({
        access_type: "paid",
        status: "active",
        expires_at: null,
      })
      .eq("id", access.id);
    if (accessErr) throw new Error(accessErr.message);

    // 2) Remove o prefixo "demo-" do slug da organização.
    if (orgId) {
      try {
        const { data: org } = await admin
          .from("organizations")
          .select("slug")
          .eq("id", orgId)
          .maybeSingle();
        const currentSlug = (org?.slug as string | undefined) ?? "";
        if (currentSlug.startsWith("demo-")) {
          const newSlug = `org-${orgId.slice(0, 8)}`;
          await admin
            .from("organizations")
            .update({ slug: newSlug })
            .eq("id", orgId);
        }
      } catch { /* noop */ }
    }

    // 3) Log de evento.
    try {
      await admin.from("user_access_events").insert({
        user_id: userId,
        organization_id: orgId,
        event: "DEMO_CONVERTED_TO_PAID",
        meta: { converted_at: new Date().toISOString() },
      });
    } catch { /* noop */ }

    return { alreadyConverted: false, organizationId: orgId };
  });

// Endpoint chamado pelo cron para remover organizações demo com mais de 30 dias.
export async function cleanupExpiredDemoOrgs(): Promise<{
  organizations: number;
  users: number;
}> {
  const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
  const admin = createOwnSupabaseAdminClient() as AnyClient;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Busca orgs demo antigas (identificadas pelo prefixo do slug).
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, created_at")
    .like("slug", "demo-%")
    .lt("created_at", cutoff)
    .limit(200);

  if (!orgs || orgs.length === 0) {
    return { organizations: 0, users: 0 };
  }

  let usersDeleted = 0;
  for (const org of orgs as Array<{ id: string }>) {
    // Usuários vinculados a esta org.
    const { data: members } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.id);
    const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

    // Delete org (cascade em cad_leads, deals, clients, prospects, etc.).
    try { await admin.from("organizations").delete().eq("id", org.id); } catch { /* noop */ }

    // Delete usuários demo do Auth (só os criados como demo).
    for (const uid of userIds) {
      try {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta = (u?.user?.user_metadata ?? {}) as any;
        if (meta?.is_demo === true) {
          await admin.auth.admin.deleteUser(uid);
          usersDeleted++;
        }
      } catch { /* noop */ }
    }
  }

  return { organizations: orgs.length, users: usersDeleted };
}