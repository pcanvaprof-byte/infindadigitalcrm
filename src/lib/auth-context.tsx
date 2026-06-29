import { Navigate, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
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

  useEffect(() => {
    let cancelled = false;

    const applyUser = async (authUser: SupabaseUser | null) => {
      if (!authUser) {
        setUser(null);
        setIsReady(true);
        return;
      }

      const appUser = await toAppUser(authUser);
      if (!cancelled) {
        setUser(appUser);
        setIsReady(true);
      }
    };

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      await applyUser(error ? null : data.user);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Invalida o cache de organization_id em qualquer transição de identidade
      // (SIGNED_IN, SIGNED_OUT, USER_UPDATED) para impedir vazamento cross-tenant.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void import("@/lib/bi/tz").then((m) => m.resetOrgIdCache());
      }
      void applyUser(session?.user ?? null);
    });

    void initializeSession();

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login: AuthCtx["login"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: "E-mail ou senha inválidos." };
    }

    if (data.user) {
      setUser(await toAppUser(data.user));
    }

    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
