import { Navigate, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { clearStoredAuthSession, isAuthTokenError } from "@/lib/auth-session-recovery";
import type { MockUser, Role } from "@/lib/mvp-accounts";

export type { MockUser, Role };

interface AuthCtx {
  user: MockUser | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

type RoleLookupClient = {
  from: (table: "user_roles") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { role?: unknown } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

function getDisplayName(authUser: SupabaseUser) {
  const metaName = authUser.user_metadata?.full_name || authUser.user_metadata?.name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  return authUser.email?.split("@")[0] || "Usuário";
}

async function resolveRole(userId: string): Promise<Role> {
  try {
    const roleClient = supabase as unknown as RoleLookupClient;
    const { data, error } = await roleClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return "consultor";
    return data?.role === "admin" ? "admin" : "consultor";
  } catch {
    return "consultor";
  }
}

async function toAppUser(authUser: SupabaseUser): Promise<MockUser> {
  return {
    id: authUser.id,
    name: getDisplayName(authUser),
    email: authUser.email ?? "",
    role: await resolveRole(authUser.id),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let currentUserId: string | null = null;

    const applyUser = async (authUser: SupabaseUser | null) => {
      if (!authUser) {
        currentUserId = null;
        setUser(null);
        setIsReady(true);
        return;
      }

      const appUser = await toAppUser(authUser);
      if (!cancelled) {
        currentUserId = appUser.id;
        setUser(appUser);
        setIsReady(true);
      }
    };

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error && isAuthTokenError(error)) {
        clearStoredAuthSession();
        await applyUser(null);
        return;
      }
      await applyUser(error ? null : data.user);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignora eventos ruidosos (TOKEN_REFRESHED, INITIAL_SESSION) que
      // disparariam re-fetch em toda a árvore sem trocar de identidade.
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      ) {
        return;
      }

      const nextId = session?.user?.id ?? null;
      const identityChanged = nextId !== currentUserId;

      // Invalida o cache de organization_id sempre que a identidade muda,
      // e limpa completamente o cache de queries no logout / troca de usuário
      // para impedir vazamento cross-tenant.
      if (identityChanged) {
        void import("@/lib/bi/tz").then((m) => m.resetOrgIdCache());
        queryClient.clear();
      }

      void applyUser(session?.user ?? null);
    });

    void initializeSession();

    // Revalidação ativa: após um "logout global" em outro dispositivo, os
    // refresh tokens deste navegador são invalidados no servidor. Sem tráfego,
    // nada dispararia SIGNED_OUT — então revalidamos a sessão ao focar a aba
    // e a cada 60s. Se o servidor não reconhece mais o usuário, limpamos
    // storage local e o RequireAuth redireciona para /login.
    const revalidateSession = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      const stillValid = !error && !!data.user;
      if (!stillValid && currentUserId) {
        clearStoredAuthSession();
        queryClient.clear();
        await applyUser(null);
      }
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void revalidateSession();
      }
    };

    const intervalId =
      typeof window !== "undefined"
        ? window.setInterval(() => void revalidateSession(), 60_000)
        : null;

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
      if (intervalId !== null) window.clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [queryClient]);

  const login: AuthCtx["login"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: "E-mail ou senha inválidos." };
    }

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      return { ok: false, error: "Não foi possível validar a sessão. Tente novamente." };
    }

    setUser(await toAppUser(data.user));
    setIsReady(true);
    return { ok: true };
  };

  const logout = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    // O onAuthStateChange (SIGNED_OUT) limpa o cache e o user; forçamos
    // aqui também para feedback imediato caso o evento demore a chegar.
    setUser(null);
  };

  return <Ctx.Provider value={{ user, isReady, login, logout }}>{children}</Ctx.Provider>;
}

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando sessão…</p>
      </div>
    </div>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export function useRequiredUser() {
  const { user } = useAuth();
  if (!user) throw new Error("Authenticated route rendered without a user");
  return user;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!isReady) return <AuthLoadingScreen />;
  if (!user) {
    return (
      <Navigate
        to="/login"
        search={{ redirect: pathname === "/login" ? "/dashboard" : pathname } as never}
        replace
      />
    );
  }

  return <>{children}</>;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  consultor: "Consultor Comercial",
};
