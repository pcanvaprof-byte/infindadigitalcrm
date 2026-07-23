import { createFileRoute } from "@tanstack/react-router";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const MP_API = "https://api.mercadopago.com";

async function fetchPreapproval(id: string, token: string) {
  const r = await fetch(`${MP_API}/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    console.error(`[MP webhook] preapproval fetch ${id} failed [${r.status}]: ${await r.text()}`);
    return null;
  }
  return (await r.json()) as {
    id: string;
    status: string;
    external_reference?: string;
    payer_email?: string;
    reason?: string;
  };
}

async function fetchAuthorizedPayment(id: string, token: string) {
  const r = await fetch(`${MP_API}/authorized_payments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return (await r.json()) as {
    id: string;
    status?: string;
    preapproval_id?: string;
    payment?: { status?: string };
  };
}

/**
 * Ativa (ou renova) o acesso pago com base numa preapproval autorizada.
 * external_reference vem no formato "<userId>|<orgId>".
 */
async function activatePaidAccess(
  admin: AnyClient,
  preapproval: { id: string; status: string; external_reference?: string },
  monthlyRenewal = true,
) {
  const ref = preapproval.external_reference ?? "";
  const [userId] = ref.split("|");
  if (!userId) {
    console.warn(`[MP webhook] preapproval ${preapproval.id} sem external_reference válido`);
    return;
  }

  const { data: access } = await admin
    .from("user_access")
    .select("id, organization_id, access_type")
    .eq("user_id", userId)
    .maybeSingle();
  if (!access?.id) {
    console.warn(`[MP webhook] user_access ausente para user ${userId}`);
    return;
  }

  // Renovação: +35 dias a partir de agora (folga para pequenos atrasos do MP).
  const expiresAt = monthlyRenewal
    ? new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await admin
    .from("user_access")
    .update({
      access_type: "paid",
      status: "active",
      expires_at: expiresAt,
    })
    .eq("id", access.id);

  // Se ainda estava com slug de demo, normaliza.
  if (access.organization_id) {
    try {
      const { data: org } = await admin
        .from("organizations")
        .select("slug")
        .eq("id", access.organization_id)
        .maybeSingle();
      const slug = (org?.slug as string | undefined) ?? "";
      if (slug.startsWith("demo-")) {
        await admin
          .from("organizations")
          .update({ slug: `org-${(access.organization_id as string).slice(0, 8)}` })
          .eq("id", access.organization_id);
      }
    } catch { /* noop */ }
  }

  try {
    await admin.from("user_access_events").insert({
      user_id: userId,
      organization_id: access.organization_id,
      event: "MP_SUBSCRIPTION_ACTIVE",
      meta: {
        preapproval_id: preapproval.id,
        preapproval_status: preapproval.status,
        expires_at: expiresAt,
      },
    });
  } catch { /* noop */ }
}

async function suspendAccess(
  admin: AnyClient,
  preapproval: { id: string; status: string; external_reference?: string },
) {
  const [userId] = (preapproval.external_reference ?? "").split("|");
  if (!userId) return;
  const { data: access } = await admin
    .from("user_access")
    .select("id, organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!access?.id) return;
  await admin
    .from("user_access")
    .update({ status: "suspended" })
    .eq("id", access.id);
  try {
    await admin.from("user_access_events").insert({
      user_id: userId,
      organization_id: access.organization_id,
      event: "MP_SUBSCRIPTION_SUSPENDED",
      meta: { preapproval_id: preapproval.id, preapproval_status: preapproval.status },
    });
  } catch { /* noop */ }
}

export const Route = createFileRoute("/api/public/hooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!token) {
          return new Response(JSON.stringify({ error: "mp_not_configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const bodyText = await request.text();
        let body: Record<string, unknown> = {};
        try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { /* form-urlencoded ou vazio */ }

        // Aceita os vários formatos que o MP usa (query, body, action).
        const type =
          (body.type as string | undefined) ??
          (body.topic as string | undefined) ??
          url.searchParams.get("type") ??
          url.searchParams.get("topic") ??
          "";
        const dataId =
          (body as { data?: { id?: string | number } }).data?.id?.toString() ??
          url.searchParams.get("data.id") ??
          url.searchParams.get("id") ??
          "";

        console.log(`[MP webhook] type=${type} data.id=${dataId}`);

        const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
        const admin = createOwnSupabaseAdminClient() as AnyClient;

        try {
          if (
            (type === "subscription_preapproval" ||
              type === "preapproval" ||
              type.startsWith("preapproval")) &&
            dataId
          ) {
            const pre = await fetchPreapproval(dataId, token);
            if (!pre) return Response.json({ ok: true, skipped: true });
            if (pre.status === "authorized") {
              await activatePaidAccess(admin, pre, false);
            } else if (pre.status === "cancelled" || pre.status === "paused") {
              await suspendAccess(admin, pre);
            }
            return Response.json({ ok: true, status: pre.status });
          }

          if (
            (type === "subscription_authorized_payment" ||
              type === "authorized_payment") &&
            dataId
          ) {
            const ap = await fetchAuthorizedPayment(dataId, token);
            if (ap?.preapproval_id) {
              const pre = await fetchPreapproval(ap.preapproval_id, token);
              if (pre && ap.payment?.status === "approved") {
                await activatePaidAccess(admin, pre, true);
              }
            }
            return Response.json({ ok: true });
          }

          // Eventos desconhecidos — respondem 200 para o MP não reencaminhar infinitamente.
          return Response.json({ ok: true, ignored: type });
        } catch (err) {
          console.error("[MP webhook] handler error", err);
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => Response.json({ ok: true, endpoint: "mercadopago-webhook" }),
    },
  },
});
