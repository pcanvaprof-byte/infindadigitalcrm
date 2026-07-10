import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/debug-own-sb")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.OWN_SB_URL;
        const svc = process.env.OWN_SB_SERVICE_ROLE_KEY;
        const anon = process.env.OWN_SB_PUBLISHABLE_KEY || process.env.OWN_SB_ANON_KEY;
        const out: Record<string, unknown> = {
          own_sb_url: url ?? null,
          has_service: !!svc,
          service_prefix: svc ? svc.slice(0, 12) : null,
          service_len: svc?.length ?? 0,
          has_publishable: !!anon,
        };
        if (url && svc) {
          try {
            const c = createClient(url, svc, {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            });
            const { data, error } = await c.from("api_keys").select("id").limit(1);
            out.query_ok = !error;
            out.query_error = error?.message ?? null;
            out.rows = data?.length ?? 0;
          } catch (e) {
            out.query_ok = false;
            out.query_error = (e as Error).message;
          }
        }
        return Response.json(out);
      },
    },
  },
});