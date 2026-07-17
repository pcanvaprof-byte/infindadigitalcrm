import { createServerFn } from "@tanstack/react-start";
import { dbExt } from "@/integrations/supabase/types.extra";
import { authWithAccess } from "@/lib/access/auth-with-access";

/**
 * Limpa owner_name de prospects do usuário atual quando o valor é
 * exatamente igual ao nome/email do próprio usuário (resíduo do antigo
 * fallback do import que preenchia o responsável com o nome do importador).
 */
export const cleanupOwnerFallback = createServerFn({ method: "POST" })
  .middleware([authWithAccess])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
    const candidates = new Set<string>();
    const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
    const name = typeof meta.name === "string" ? meta.name.trim() : "";
    const email = typeof claims.email === "string" ? claims.email : "";
    const local = email.includes("@") ? email.split("@")[0] : "";
    for (const v of [fullName, name, local]) if (v) candidates.add(v);
    if (candidates.size === 0) return { cleared: 0, matched: [] as string[] };

    const list = Array.from(candidates);
    const { data, error } = await dbExt.from("prospects")
      .update({ owner_name: "" })
      .eq("user_id", userId)
      .in("owner_name", list)
      .select("id");
    if (error) throw new Error(error.message);

    // Limpa também os cards de cadência (cad_leads.responsavel) afetados
    // pelo mesmo resíduo do antigo fallback.
    let clearedLeads = 0;
    const sb = supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          in: (col: string, vals: string[]) => {
            select: (c: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
    const { data: leadData, error: leadErr } = await sb
      .from("cad_leads")
      .update({ responsavel: null })
      .in("responsavel", list)
      .select("id");
    if (leadErr) throw new Error(leadErr.message);
    clearedLeads = leadData?.length ?? 0;

    return {
      cleared: data?.length ?? 0,
      clearedLeads,
      matched: list,
    };
  });