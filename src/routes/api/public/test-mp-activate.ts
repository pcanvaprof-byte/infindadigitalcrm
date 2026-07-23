import { createFileRoute } from "@tanstack/react-router";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const SECRET = "bf31391153acb879b0d24b665aebef8e";

/**
 * TEMPORÁRIO — simula o webhook do Mercado Pago (preapproval `authorized`)
 * para o email informado. Remover após validação end-to-end.
 */
export const Route = createFileRoute("/api/public/test-mp-activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("secret") !== SECRET) {
          return new Response("forbidden", { status: 403 });
        }
        const { email } = (await request.json()) as { email?: string };
        if (!email) return new Response("email required", { status: 400 });

        const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
        const admin = createOwnSupabaseAdminClient() as AnyClient;

        const { data: list, error: listErr } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) return Response.json({ error: listErr.message }, { status: 500 });
        const user = (list?.users ?? []).find(
          (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase(),
        );
        if (!user) return Response.json({ error: "user_not_found", email }, { status: 404 });
        const userId = user.id as string;

        const { data: before } = await admin
          .from("user_access")
          .select("id, access_type, status, expires_at, organization_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!before?.id) {
          return Response.json({ error: "user_access_missing", userId }, { status: 404 });
        }

        const preapprovalId = `TEST-${Date.now()}`;
        const expiresAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();

        await admin
          .from("user_access")
          .update({ access_type: "paid", status: "active", expires_at: expiresAt })
          .eq("id", before.id);

        let slugFix: { from: string; to: string } | null = null;
        if (before.organization_id) {
          const { data: org } = await admin
            .from("organizations")
            .select("slug")
            .eq("id", before.organization_id)
            .maybeSingle();
          const slug = (org?.slug as string | undefined) ?? "";
          if (slug.startsWith("demo-")) {
            const newSlug = `org-${(before.organization_id as string).slice(0, 8)}`;
            await admin
              .from("organizations")
              .update({ slug: newSlug })
              .eq("id", before.organization_id);
            slugFix = { from: slug, to: newSlug };
          }
        }

        await admin.from("user_access_events").insert({
          user_id: userId,
          organization_id: before.organization_id,
          event: "MP_SUBSCRIPTION_ACTIVE",
          meta: {
            preapproval_id: preapprovalId,
            preapproval_status: "authorized",
            expires_at: expiresAt,
            simulated: true,
          },
        });

        const { data: after } = await admin
          .from("user_access")
          .select("access_type, status, expires_at, organization_id")
          .eq("user_id", userId)
          .maybeSingle();

        const { data: events } = await admin
          .from("user_access_events")
          .select("event, meta, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(3);

        return Response.json({
          ok: true,
          userId,
          email,
          before,
          after,
          slugFix,
          recentEvents: events,
        });
      },
    },
  },
});