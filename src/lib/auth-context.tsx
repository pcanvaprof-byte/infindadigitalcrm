import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
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

function fromSupabaseUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): MockUser {
  const email = user.email ?? "";
  const rawName =
    user.user_metadata?.name ?? user.user_metadata?.full_name ?? email.split("@")[0] ?? "Usuário";
  const rawRole = user.user_metadata?.role;
  return {
    name: String(rawName || "Usuário"),
    email,
    role: rawRole === "admin" || rawRole === "consultor" ? rawRole : "consultor",
  };
}

function getLoginErrorMessage(message: string) {
  const msg = message.toLowerCase();
  if (/missing email|email or phone|validation_failed/.test(msg)) {
    return "Informe email e senha para entrar.";
  }
  if (/invalid login credentials|invalid credentials|invalid_grant/.test(msg)) {
    return "Email ou senha incorretos para o Supabase conectado.";
  }
  if (/email not confirmed|not confirmed/.test(msg)) {
    return "Conta sem e-mail confirmado no Supabase. Confirme o usuário em Authentication → Users.";
  }
  if (/rate limit|too many requests/.test(msg)) {
    return "Muitas tentativas em pouco tempo. Aguarde ~1 min e tente novamente.";
  }
  if (/failed to fetch|network|cors|fetch/.test(msg)) {
    return "Não foi possível conectar ao Supabase configurado. Verifique URL, chave anon e domínios permitidos.";
  }
  return `Falha no Supabase: ${message}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    async function restore() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!alive) return;
        if (error) {
          setUser(null);
          void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          return;
        }
        setUser(data.user ? fromSupabaseUser(data.user) : null);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setIsReady(true);
      }
    }
    void restore();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? fromSupabaseUser(session.user) : null);
      setIsReady(true);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login: AuthCtx["login"] = async (email, password) => {
    const e = email.trim().toLowerCase();
    if (!e || !password) {
      return { ok: false, error: "Informe email e senha para entrar." };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
    if (error || !data.user || !data.session) {
      const msg = error?.message ?? "Falha desconhecida";
      return { ok: false, error: getLoginErrorMessage(msg) };
    }
    setUser(fromSupabaseUser(data.user));
    setIsReady(true);
    return { ok: true };
  };

  const logout = async () => {
    setUser(null);
    setIsReady(true);
    await supabase.auth.signOut();
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
  if (!isReady) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  consultor: "Consultor Comercial",
};
