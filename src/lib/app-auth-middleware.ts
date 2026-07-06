import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const APP_AUTH_URL = "https://oxmhwwopxurwqcrwgsyf.supabase.co";
const APP_AUTH_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bWh3d29weHVyd3Fjcndnc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzA2NjYsImV4cCI6MjA5NzEwNjY2Nn0.nAGtGeU-7YkzIjjCKJnfH5yeJ7LsQ-2s5ltMgHF7v88";

type AppClaims = Record<string, unknown> & {
  sub?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function getAppAuthConfig() {
  const url = process.env.OWN_SB_URL || APP_AUTH_URL;
  const key =
    process.env.OWN_SB_PUBLISHABLE_KEY ||
    process.env.OWN_SB_ANON_KEY ||
    APP_AUTH_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Configuração de autenticação do app ausente no servidor.");
  }

  return { url, key };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");

    if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token.split(".").length !== 3) {
      throw new Error("Unauthorized: Invalid token");
    }

    const { url, key } = getAppAuthConfig();
    const supabase = createClient<Database>(url, key, {
      global: {
        fetch: createSupabaseFetch(key),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    let claims = data?.claims as AppClaims | undefined;

    if (error || !claims?.sub) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      const user = userData.user;
      if (userError || !user) throw new Error("Unauthorized: Invalid token");
      claims = {
        sub: user.id,
        email: user.email,
        aud: user.aud,
        role: user.role,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
      };
    }

    const userId = claims.sub;
    if (!userId) throw new Error("Unauthorized: No user ID found in token");

    return next({
      context: {
        supabase,
        userId,
        claims,
      },
    });
  },
);