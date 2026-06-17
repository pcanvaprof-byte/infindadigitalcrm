import { createContext, useContext, useState, type ReactNode } from "react";
import type { MockUser, Role } from "@/lib/mvp-accounts";

export type { MockUser, Role };

interface AuthCtx {
  user: MockUser | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const DEFAULT_USER: MockUser = {
  name: "Administrador",
  email: "admin@infinda.com",
  role: "admin",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<MockUser | null>(DEFAULT_USER);
  const [isReady] = useState(true);

  const login: AuthCtx["login"] = async () => {
    return { ok: true };
  };

  const logout = async () => {
    // no-op: autenticação desativada
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
  return <>{children}</>;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  consultor: "Consultor Comercial",
};
