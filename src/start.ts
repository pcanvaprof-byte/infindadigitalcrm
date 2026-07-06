import { createStart, createMiddleware } from "@tanstack/react-start";

import { attachValidSupabaseAuth } from "./lib/supabase-auth-function-middleware";
import { renderErrorPage } from "./lib/error-page";

function alignAuthBackendEnv() {
  const ownUrl = process.env.OWN_SB_URL;
  const ownPublishableKey = process.env.OWN_SB_PUBLISHABLE_KEY;

  if (ownUrl && ownPublishableKey) {
    process.env.SUPABASE_URL = ownUrl;
    process.env.SUPABASE_PUBLISHABLE_KEY = ownPublishableKey;
  }
}

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    alignAuthBackendEnv();
    return await next();
  } catch (error) {
    if (request.url.includes("/_serverFn/")) {
      throw error;
    }
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachValidSupabaseAuth],
}));
