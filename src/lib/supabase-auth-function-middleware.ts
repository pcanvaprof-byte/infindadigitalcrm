import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

type JwtPayload = {
  exp?: number;
  iss?: string;
  ref?: string;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  if (typeof window === "undefined" || typeof window.atob !== "function") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

function expectedProjectRef() {
  const direct = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (direct) return direct;

  try {
    const url = new URL(import.meta.env.VITE_SUPABASE_URL);
    return url.hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function tokenBelongsToCurrentBackend(payload: JwtPayload) {
  const projectRef = expectedProjectRef();
  if (!projectRef) return true;
  if (payload.ref === projectRef) return true;
  return typeof payload.iss === "string" && payload.iss.includes(projectRef);
}

function isUsableToken(token: string) {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  if (!tokenBelongsToCurrentBackend(payload)) return false;
  if (payload.exp && payload.exp * 1000 <= Date.now()) return false;
  return true;
}

export const attachValidSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") return next();

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) return next({ headers: {} });

    // Não redireciona aqui: um redirect dentro do middleware do serverFn
    // pode disparar logo após o login (ex.: token recém-emitido em formato
    // novo que a heurística local considera "inválido") e derrubar a sessão.
    // Se o token parecer inutilizável, apenas não anexa — o backend responde
    // 401 e a UI decide o que fazer.
    if (!isUsableToken(token)) {
      return next({ headers: {} });
    }

    return next({
      headers: { Authorization: `Bearer ${token}` },
    });
  },
);
