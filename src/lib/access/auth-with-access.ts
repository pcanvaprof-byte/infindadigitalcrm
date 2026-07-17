import { createMiddleware } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/lib/app-auth-middleware";

export type AccessStatus = {
  status: "active" | "expired" | "suspended";
  access_type: "trial" | "paid" | "internal" | null;
  plan_name: string | null;
  expires_at: string | null;
  days_remaining: number | null;
  must_change_password: boolean;
  is_privileged: boolean;
};

/**
 * Middleware central: autentica o usuário via Supabase e, na sequência,
 * exige acesso ativo (não expirado / não suspenso) e sem troca de senha
 * pendente. Usado por TODAS as server functions de negócio.
 *
 * Server functions da própria camada de acesso (getAccessStatus,
 * markPasswordChanged, provisionMemberUser, renewUserAccess) usam
 * apenas `requireSupabaseAuth` para evitar loops.
 */
export const authWithAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    const { data, error } = await supabase.rpc("check_access_status");
    if (error) {
      // Falha na verificação = bloqueia (fail-closed).
      throw new Error(`access_check_failed: ${error.message}`);
    }
    const access = data as AccessStatus;
    if (access.status !== "active") {
      throw new Error("access_expired");
    }
    if (access.must_change_password) {
      throw new Error("password_change_required");
    }
    return next({ context: { access } });
  });