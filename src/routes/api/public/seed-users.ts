import { createFileRoute } from "@tanstack/react-router";

const ORG_ID = "f7bde4c5-4c5f-4072-9b31-abb6a7c00b9f";
const SEED_TOKEN = "seed-9f2c-2026";

type SeedUser = { email: string; password: string; role: "admin" | "member" };

const USERS: SeedUser[] = [
  { email: "cardosovaldnei@gmail.com", password: "971009@Fd", role: "admin" },
  { email: "pcanvaprof@gmail.com", password: "971009@Fd", role: "member" },
];

export const Route = createFileRoute("/api/public/seed-users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== SEED_TOKEN) {
          return new Response("unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: unknown[] = [];
        for (const u of USERS) {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
          });
          let userId = created?.user?.id ?? null;
          if (createErr && !userId) {
            // Already exists — look it up.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: list } = await (supabaseAdmin.auth.admin as any).listUsers({ page: 1, perPage: 1000 });
            userId = list?.users?.find((x: { email?: string }) => x.email === u.email)?.id ?? null;
          }
          if (!userId) {
            results.push({ email: u.email, error: createErr?.message ?? "no user id" });
            continue;
          }
          const { error: memErr } = await supabaseAdmin
            .from("organization_members")
            .upsert(
              { organization_id: ORG_ID, user_id: userId, role: u.role },
              { onConflict: "organization_id,user_id" },
            );
          const { error: activeErr } = await supabaseAdmin
            .from("user_active_org")
            .upsert({ user_id: userId, organization_id: ORG_ID }, { onConflict: "user_id" });
          results.push({
            email: u.email,
            user_id: userId,
            role: u.role,
            member_error: memErr?.message ?? null,
            active_error: activeErr?.message ?? null,
          });
        }
        return new Response(JSON.stringify({ ok: true, results }, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});