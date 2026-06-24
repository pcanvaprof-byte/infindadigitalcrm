import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Limpa owner_name de prospects do usuário atual quando o valor é
 * exatamente igual ao nome/email do próprio usuário (resíduo do antigo
 * fallback do import que preenchia o responsável com o nome do importador).
 */
export const cleanupOwnerFallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    const { data, error } = await supabase
      .from("prospects")
      .update({ owner_name: "" })
      .eq("user_id", userId)
      .in("owner_name", Array.from(candidates))
      .select("id");
    if (error) throw new Error(error.message);
    return { cleared: data?.length ?? 0, matched: Array.from(candidates) };
  });