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
        if (url && anon) {
          try {
            const c = createClient(url, anon, {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            });
            const { data, error } = await c.from("api_keys").select("id").limit(1);
            out.pub_query_ok = !error;
            out.pub_query_error = error?.message ?? null;
            out.pub_prefix = anon.slice(0, 30);
            out.pub_len = anon.length;
          } catch (e) {
            out.pub_query_ok = false;
            out.pub_query_error = (e as Error).message;
          }
        }
        return Response.json(out);
      },
    },
  },
});