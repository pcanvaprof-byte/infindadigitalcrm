import { createMiddleware } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";

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
      const fallback: AccessStatus = {
        status: "active",
        access_type: "internal",
        plan_name: null,
        expires_at: null,
        days_remaining: null,
        must_change_password: false,
        is_privileged: true,
      };
      // Fail-open enquanto a migração de user_access não foi aplicada:
      // não podemos derrubar toda a plataforma se a RPC ainda não existe.
      return next({ context: { access: fallback } });
    }
    const access = data as AccessStatus;
    if (access.status !== "active") {
      throw redirect({ to: "/assinatura" });
    }
    if (access.must_change_password) {
      throw redirect({ to: "/alterar-senha" });
    }
    return next({ context: { access } });
  });