import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import {
  clearStoredAuthSession,
  isAuthTokenError,
  redirectToAuthForFreshSession,
} from "@/lib/auth-session-recovery";

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

function resetInvalidSession(): never {
  clearStoredAuthSession();
  redirectToAuthForFreshSession();
  throw new Error("Sessão expirada. Faça login novamente.");
}

async function getValidatedAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  if (!isUsableToken(token)) return resetInvalidSession();

  // Decoding catches malformed/expired JWTs, but not rotated signing keys.
  // Revalidate with the auth backend before any protected server function call
  // so an old browser session is cleared locally instead of being sent to the
  // server and crashing the preview with "Unauthorized: Invalid token".
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    if (!error || isAuthTokenError(error)) return resetInvalidSession();
    return null;
  }

  const { data: refreshed } = await supabase.auth.getSession();
  const refreshedToken = refreshed.session?.access_token ?? token;
  if (!isUsableToken(refreshedToken)) return resetInvalidSession();
  return refreshedToken;
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
