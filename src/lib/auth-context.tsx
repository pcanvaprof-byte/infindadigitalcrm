import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SEED_ACCOUNTS, type AccountSeed, type MockUser, type Role } from "@/lib/mvp-accounts";

export { SEED_ACCOUNTS, type AccountSeed, type MockUser, type Role };

interface AuthCtx {
  user: MockUser | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  loginAs: (user: MockUser) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "infinda.user";

function readStoredUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

/**
 * Garante uma sessão Supabase para o usuário do MVP.
 * Tenta sign-in; se a conta não existir, faz sign-up e sign-in.
 * Necessário para que as RLS policies (auth.uid()) funcionem.
 */
async function ensureSupabaseSession(
  seed: AccountSeed,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user.email?.toLowerCase() === seed.email.toLowerCase()) {
    return { ok: true };
  }

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: seed.email,
    password: seed.password,
  });
  if (signIn?.session) return { ok: true };

  const msg = signInError?.message ?? "Falha desconhecida";
  if (/rate limit/i.test(msg)) {
    return { ok: false, error: "Muitas tentativas em pouco tempo. Aguarde ~1 min e tente novamente." };
  }
  if (/email not confirmed/i.test(msg)) {
    return { ok: false, error: "Conta sem e-mail confirmado. Desative confirmação em Cloud → Users → Auth Settings." };
  }
  return { ok: false, error: `Falha no Cloud: ${msg}` };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    async function restore() {
      const stored = readStoredUser();
      if (!stored) {
        if (alive) setIsReady(true);
        return;
      }
      const seed = SEED_ACCOUNTS.find((a) => a.email.toLowerCase() === stored.email.toLowerCase());
      const result = seed ? await ensureSupabaseSession(seed) : { ok: false as const };
      if (!alive) return;
      if (result.ok) {
        setUser(stored);
      } else {
        window.localStorage.removeItem(KEY);
        setUser(null);
      }
      setIsReady(true);
    }
    void restore();
    return () => { alive = false; };
  }, []);

  const login: AuthCtx["login"] = async (email, password) => {
    const e = email.trim().toLowerCase();
    const found = SEED_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === e && a.password === password,
    );
    if (!found) return { ok: false, error: "Email ou senha inválidos." };
    const u: MockUser = { name: found.name, email: found.email, role: found.role };
    const session = await ensureSupabaseSession(found);
    if (!session.ok) return { ok: false, error: session.error };
    window.localStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
    setIsReady(true);
    return { ok: true };
  };

  const loginAs: AuthCtx["loginAs"] = async (u) => {
    const seed = SEED_ACCOUNTS.find((a) => a.email.toLowerCase() === u.email.toLowerCase());
    if (!seed) return { ok: false, error: "Conta de acesso rápido inválida." };
    const session = await ensureSupabaseSession(seed);
    if (!session.ok) return { ok: false, error: session.error };
    window.localStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
    setIsReady(true);
    return { ok: true };
  };

  const logout = async () => {
    window.localStorage.removeItem(KEY);
    setUser(null);
    setIsReady(true);
    await supabase.auth.signOut();
  };

  return <Ctx.Provider value={{ user, isReady, login, loginAs, logout }}>{children}</Ctx.Provider>;
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
