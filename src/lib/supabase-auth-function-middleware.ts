import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

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

  // Do not clear stored session here — that forces the user to sign out again
  // on any transient token error. Just skip attaching a bad token and let the
  // caller decide how to handle a 401.
  if (!isUsableToken(token)) return null;
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
