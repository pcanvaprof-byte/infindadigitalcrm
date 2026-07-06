import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { clearStoredAuthSession, isAuthTokenError } from "@/lib/auth-session-recovery";

type JwtPayload = {
  exp?: number;
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

function isUsableToken(token: string) {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  if (payload.exp && payload.exp * 1000 <= Date.now()) return false;
  return true;
}

async function getValidatedAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  if (!isUsableToken(token)) {
    clearStoredAuthSession();
    return null;
  }

  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) {
    if (isAuthTokenError(error)) clearStoredAuthSession();
    return null;
  }

  return token;
}

export const attachValidSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") return next();

    try {
      const token = await getValidatedAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      return await next({ headers });
    } catch (caught) {
      throw caught;
    }
  },
);
