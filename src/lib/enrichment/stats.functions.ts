import { createServerFn } from "@tanstack/react-start";
import { authWithAccess } from "@/lib/access/auth-with-access";

/**
 * Métricas globais do enriquecimento (base compartilhada).
 * Restrito a Owner/Admin — Members recebem `null`.
 */
export const getEnrichmentStats = createServerFn({ method: "GET" })
  .middleware([authWithAccess])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    const { data: role } = await supabase.rpc("current_org_role");
    if (role !== "owner" && role !== "admin") return null;
    const { enrichmentStats } = await import("./pipeline.server");
    return await enrichmentStats();
  });
