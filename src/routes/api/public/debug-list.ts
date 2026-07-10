import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/debug-list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = process.env.OWN_SB_URL!;
        const svc = process.env.OWN_SB_SERVICE_ROLE_KEY!;
        const c = createClient(url, svc, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });
        const u = new URL(request.url);
        if (u.searchParams.get("create") === "1") {
          const userId = u.searchParams.get("user")!;
          const name = u.searchParams.get("name") || "teste";
          // Ensure membership
          const { data: mem } = await c.from("organization_members").select("organization_id").eq("user_id", userId).limit(1);
          let orgId = mem?.[0]?.organization_id as string | undefined;
          if (!orgId) {
            const { data: org } = await c.from("organizations").select("id").limit(1).maybeSingle();
            orgId = org?.id;
            if (orgId) await c.from("organization_members").insert({ organization_id: orgId, user_id: userId, role: "owner" });
          }
          if (!orgId) return Response.json({ error: "no org" }, { status: 500 });
          const rand = new Uint8Array(32);
          crypto.getRandomValues(rand);
          const full = "infd_live_" + toBase64Url(rand);
          const prefix = full.slice(0, 16);
          const hash = await sha256Hex(full);
          const { data, error } = await c
            .from("api_keys")
            .insert({ organization_id: orgId, created_by: userId, name, prefix, key_hash: hash })
            .select("id, name, prefix, created_at")
            .single();
          return Response.json({ created: data, full_key: full, error: error?.message });
        }
        const { data, error } = await c.from("api_keys").select("id, name, prefix, created_at").order("created_at", { ascending: false }).limit(5);
        return Response.json({ data, error: error?.message });
      },
    },
  },
});