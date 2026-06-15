import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "consultor";

export interface MockUser {
  name: string;
  email: string;
  role: Role;
}

export interface AccountSeed extends MockUser {
  password: string;
}

// MVP: contas pré-cadastradas diretamente na ferramenta
export const SEED_ACCOUNTS: AccountSeed[] = [
  {
    name: "Danielly",
    email: "danielly@infinda.com",
    password: "danielly123",
    role: "admin",
  },
  {
    name: "Valdinei",
    email: "valdinei@infinda.com",
    password: "valdinei123",
    role: "consultor",
  },
];

interface AuthCtx {
  user: MockUser | null;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  loginAs: (user: MockUser) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "infinda.user";

/**
 * Garante uma sessão Supabase para o usuário do MVP.
 * Tenta sign-in; se a conta não existir, faz sign-up e sign-in.
 * Necessário para que as RLS policies (auth.uid()) funcionem.
 */
async function ensureSupabaseSession(seed: AccountSeed) {
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: seed.email,
    password: seed.password,
  });
  if (signIn?.session) return;

  if (signInErr) {
    const { error: signUpErr } = await supabase.auth.signUp({
      email: seed.email,
      password: seed.password,
      options: {
        data: { name: seed.name, role: seed.role },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (signUpErr && !/already|registered/i.test(signUpErr.message)) {
      console.warn("[auth] supabase signUp falhou:", signUpErr.message);
    }
    await supabase.auth.signInWithPassword({ email: seed.email, password: seed.password });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const u = JSON.parse(raw) as MockUser;
        setUser(u);
        // re-hidrata sessão Supabase em background
        const seed = SEED_ACCOUNTS.find((a) => a.email.toLowerCase() === u.email.toLowerCase());
        if (seed) void ensureSupabaseSession(seed);
      }
    } catch {
      /* noop */
    }
  }, []);

  const login: AuthCtx["login"] = async (email, password) => {
    const e = email.trim().toLowerCase();
    const found = SEED_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === e && a.password === password,
    );
    if (!found) return { ok: false, error: "Email ou senha inválidos." };
    const u: MockUser = { name: found.name, email: found.email, role: found.role };
    localStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
    await ensureSupabaseSession(found);
    return { ok: true };
  };

  const loginAs: AuthCtx["loginAs"] = async (u) => {
    localStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
    const seed = SEED_ACCOUNTS.find((a) => a.email.toLowerCase() === u.email.toLowerCase());
    if (seed) await ensureSupabaseSession(seed);
  };

  const logout = async () => {
    localStorage.removeItem(KEY);
    setUser(null);
    await supabase.auth.signOut();
  };

  return <Ctx.Provider value={{ user, login, loginAs, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  consultor: "Consultor Comercial",
};
