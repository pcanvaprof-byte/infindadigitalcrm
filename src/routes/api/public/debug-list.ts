import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/debug-list")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.OWN_SB_URL!;
        const svc = process.env.OWN_SB_SERVICE_ROLE_KEY!;
        const c = createClient(url, svc, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });
        const { data, error } = await c.from("api_keys").select("id, name, prefix, created_at").order("created_at", { ascending: false }).limit(5);
        return Response.json({ data, error: error?.message });
      },
    },
  },
});