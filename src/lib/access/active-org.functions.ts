import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/**
 * Após login: garante que `user_active_org` aponte para a organização
 * organização que contém a base compartilhada de prospecção. Contas novas
 * mantêm seu workspace próprio, mas também entram como members na base inicial.
 */
export const ensureBestActiveOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId as string;

    const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
    const admin = createOwnSupabaseAdminClient() as AnyClient;

    // 1) Todas as memberships do usuário.
    const { data: memberships } = await admin
      .from("organization_members")
      .select("organization_id, role, joined_at")
      .eq("user_id", userId);

    const rows = (memberships ?? []) as Array<{
      organization_id: string;
      role: string | null;
      joined_at: string | null;
    }>;

    // 2) Descobre a organização da base compartilhada sem contar milhares de
    // linhas. A base atual está concentrada em uma organização.
    const { data: sharedRow, error: sharedError } = await admin
      .from("prospects")
      .select("organization_id")
      .is("merged_into", null)
      .not("organization_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (sharedError) throw new Error(sharedError.message);
    const sharedOrg = (sharedRow as { organization_id?: string } | null)?.organization_id ?? null;
    if (!sharedOrg) return { picked: null, reason: "no_shared_base" as const };

    // 3) Se necessário, vincula o usuário à base apenas como member. Isso não
    // altera o workspace próprio nem concede privilégios administrativos.
    if (!rows.some((row) => row.organization_id === sharedOrg)) {
      const { error: memberError } = await admin.from("organization_members").insert({
        organization_id: sharedOrg,
        user_id: userId,
        role: "member",
      });
      if (memberError) throw new Error(memberError.message);
    }

    const { data: currentRow } = await admin
      .from("user_active_org")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    const currentOrg = (currentRow as { organization_id?: string } | null)?.organization_id ?? null;

    if (currentOrg === sharedOrg) {
      return { picked: sharedOrg, reason: "already_active" as const };
    }

    await admin
      .from("user_active_org")
      .upsert(
        { user_id: userId, organization_id: sharedOrg, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    // Auditoria: registra a troca automática (usuário, org anterior, org nova, score).
    try {
      await admin.from("org_switch_audit").insert({
        user_id: userId,
        previous_org_id: currentOrg,
        new_org_id: sharedOrg,
        reason: currentOrg ? "shared_prospect_base" : "shared_prospect_base_no_current",
        previous_score: null,
        new_score: null,
        metadata: {
          source: "ensureBestActiveOrg",
          membership_count: rows.length,
          assigned_role: "member",
        },
      });
    } catch {
      /* auditoria não deve bloquear a troca */
    }

    return { picked: sharedOrg, reason: "switched" as const, previous: currentOrg };
  });