import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/**
 * Após login: garante que `user_active_org` aponte para a organização
 * "mais rica" (com dados reais) do usuário — evita ficar preso em uma
 * org duplicada/vazia quando o mesmo usuário é membro de várias.
 *
 * Score = cad_leads + clients + proposals + business_profiles + cad_templates
 * dentro daquela org. Empate → preferência para role owner > admin > member,
 * depois joined_at mais antigo. Nunca cria ou remove memberships.
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

    if (rows.length === 0) {
      return { picked: null, reason: "no_memberships" as const };
    }
    if (rows.length === 1) {
      const only = rows[0]!.organization_id;
      await admin
        .from("user_active_org")
        .upsert(
          { user_id: userId, organization_id: only, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      return { picked: only, reason: "single_membership" as const };
    }

    // 2) Score por org: soma linhas em tabelas-chave.
    const orgIds = rows.map((r) => r.organization_id);
    const countTable = async (table: string): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      for (const orgId of orgIds) {
        const { count } = await admin
          .from(table)
          .select("id", { head: true, count: "exact" })
          .eq("organization_id", orgId);
        out[orgId] = count ?? 0;
      }
      return out;
    };

    const tables = [
      "cad_leads",
      "clients",
      "proposals",
      "business_profiles",
      "cad_templates",
      "prospects",
    ];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const perOrg = await countTable(t);
      for (const [orgId, n] of Object.entries(perOrg)) {
        // Prospects ficam num "balde" à parte: só desempata quando as outras
        // tabelas estão zeradas em todas as orgs (evita que um dump de prospects
        // sem operação sobreponha uma org com clientes/leads reais).
        const weight = t === "prospects" ? 0.001 : 1;
        counts[orgId] = (counts[orgId] ?? 0) + n * weight;
      }
    }

    const roleWeight = (role: string | null) => {
      if (role === "owner") return 2;
      if (role === "admin") return 1;
      return 0;
    };

    const ranked = [...rows].sort((a, b) => {
      const sa = counts[a.organization_id] ?? 0;
      const sb = counts[b.organization_id] ?? 0;
      if (sb !== sa) return sb - sa;
      const ra = roleWeight(a.role);
      const rb = roleWeight(b.role);
      if (rb !== ra) return rb - ra;
      const ja = a.joined_at ? Date.parse(a.joined_at) : Number.POSITIVE_INFINITY;
      const jb = b.joined_at ? Date.parse(b.joined_at) : Number.POSITIVE_INFINITY;
      return ja - jb;
    });

    const winner = ranked[0]!.organization_id;

    // 3) Se a org ativa atual já é a vencedora, não mexe.
    const { data: currentRow } = await admin
      .from("user_active_org")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    const currentOrg = (currentRow as { organization_id?: string } | null)?.organization_id ?? null;

    if (currentOrg === winner) {
      return { picked: winner, reason: "already_active" as const };
    }

    // 4) Só troca se a vencedora tem score > 0 OU se a atual não é uma
    // membership válida (evita "roubar" foco quando todas as orgs estão vazias).
    const winnerScore = counts[winner] ?? 0;
    const currentIsMember = currentOrg && rows.some((r) => r.organization_id === currentOrg);
    if (winnerScore === 0 && currentIsMember) {
      return { picked: currentOrg, reason: "kept_current_empty" as const };
    }

    await admin
      .from("user_active_org")
      .upsert(
        { user_id: userId, organization_id: winner, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    // Auditoria: registra a troca automática (usuário, org anterior, org nova, score).
    try {
      await admin.from("org_switch_audit").insert({
        user_id: userId,
        previous_org_id: currentOrg,
        new_org_id: winner,
        reason: currentOrg ? "auto_switch_empty_current" : "auto_set_no_current",
        previous_score: currentOrg ? counts[currentOrg] ?? 0 : null,
        new_score: winnerScore,
        metadata: {
          source: "ensureBestActiveOrg",
          membership_count: rows.length,
          scores: counts,
          winner_role: ranked[0]!.role,
        },
      });
    } catch {
      /* auditoria não deve bloquear a troca */
    }

    return { picked: winner, reason: "switched" as const, previous: currentOrg };
  });