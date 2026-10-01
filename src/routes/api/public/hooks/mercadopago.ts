import { createFileRoute } from "@tanstack/react-router";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const MP_API = "https://api.mercadopago.com";
const RENEWAL_DAYS = 35; // 30 dias do ciclo + 5 dias de folga p/ atrasos do MP

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
  if (!r.ok) {
    console.error(`[MP webhook] authorized_payment fetch ${id} failed [${r.status}]: ${await r.text()}`);
    return null;
  }
  return (await r.json()) as {
    id: string;
    status?: string;
    preapproval_id?: string;
    payment?: { status?: string; status_detail?: string; id?: number };
    transaction_amount?: number;
    debit_date?: string;
  };
}

/**
 * Resolve o userId a partir de uma preapproval:
 * 1) external_reference no formato "<userId>|<orgId>"
 * 2) fallback: procura o evento MP_PREAPPROVAL_CREATED com esse preapproval_id em meta
 */
async function resolveUserId(
  admin: AnyClient,
  preapproval: { id: string; external_reference?: string },
): Promise<string | null> {
  const ref = preapproval.external_reference ?? "";
  const [fromRef] = ref.split("|");
  if (fromRef) return fromRef;

  console.warn(`[MP webhook] preapproval ${preapproval.id} sem external_reference — tentando fallback via user_access_events`);
  const { data: evt } = await admin
    .from("user_access_events")
    .select("user_id")
    .eq("event", "MP_PREAPPROVAL_CREATED")
    .contains("meta", { preapproval_id: preapproval.id })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (evt?.user_id as string | undefined) ?? null;
}

/**
 * Ativa (ou renova) o acesso pago por 35 dias a partir de agora.
 * Chamado tanto na primeira autorização (`subscription_preapproval` → authorized)
 * quanto em cada cobrança recorrente aprovada (`subscription_authorized_payment`).
 */
async function activatePaidAccess(
  admin: AnyClient,
  preapproval: { id: string; status: string; external_reference?: string },
  source: "preapproval_authorized" | "recurring_payment",
) {
  const userId = await resolveUserId(admin, preapproval);
  if (!userId) {
    console.warn(`[MP webhook] activate: userId não resolvido para preapproval ${preapproval.id}`);
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

  const expiresAt = new Date(Date.now() + RENEWAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

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
        source,
        expires_at: expiresAt,
      },
    });
  } catch { /* noop */ }
  console.log(`[MP webhook] activate ok user=${userId} source=${source} expires=${expiresAt}`);
}

async function suspendAccess(
  admin: AnyClient,
  preapproval: { id: string; status: string; external_reference?: string },
) {
  const userId = await resolveUserId(admin, preapproval);
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
  console.log(`[MP webhook] suspend ok user=${userId} status=${preapproval.status}`);
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

        // MP envia em vários formatos: JSON body {type, data.id}, query ?topic&id, action, resource path.
        const rawType =
          (body.type as string | undefined) ??
          (body.topic as string | undefined) ??
          (body.action as string | undefined) ??
          url.searchParams.get("type") ??
          url.searchParams.get("topic") ??
          "";
        const type = rawType.toLowerCase();
        const dataId =
          (body as { data?: { id?: string | number } }).data?.id?.toString() ??
          (body as { id?: string | number }).id?.toString() ??
          (body as { resource?: string }).resource?.toString().split("/").pop() ??
          url.searchParams.get("data.id") ??
          url.searchParams.get("id") ??
          "";

        console.log(`[MP webhook] type="${rawType}" data.id="${dataId}"`);

        const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
        const admin = createOwnSupabaseAdminClient() as AnyClient;

        try {
          // --- 1) Preapproval (assinatura em si) --------------------------------
          // Statuses possíveis: pending | authorized | paused | cancelled
          const isPreapproval =
            type === "subscription_preapproval" ||
            type === "preapproval" ||
            type.startsWith("preapproval");

          if (isPreapproval && dataId) {
            const pre = await fetchPreapproval(dataId, token);
            if (!pre) return Response.json({ ok: true, skipped: "fetch_failed" });
            switch (pre.status) {
              case "authorized":
                await activatePaidAccess(admin, pre, "preapproval_authorized");
                break;
              case "cancelled":
              case "paused":
                await suspendAccess(admin, pre);
                break;
              case "pending":
                console.log(`[MP webhook] preapproval ${pre.id} pending — aguardando pagamento`);
                break;
              default:
                console.warn(`[MP webhook] preapproval ${pre.id} status desconhecido: ${pre.status}`);
            }
            return Response.json({ ok: true, status: pre.status });
          }

          // --- 2) Authorized Payment (cobrança recorrente) ---------------------
          // authorized_payment.status:         scheduled | processed | recycling | cancelled
          // authorized_payment.payment.status: approved  | rejected  | pending   | ...
          const isAuthorizedPayment =
            type === "subscription_authorized_payment" ||
            type === "authorized_payment";

          if (isAuthorizedPayment && dataId) {
            const ap = await fetchAuthorizedPayment(dataId, token);
            if (!ap?.preapproval_id) {
              console.warn(`[MP webhook] authorized_payment ${dataId} sem preapproval_id`);
              return Response.json({ ok: true, skipped: "no_preapproval_id" });
            }
            const paymentStatus = ap.payment?.status;
            if (paymentStatus === "approved") {
              const pre = await fetchPreapproval(ap.preapproval_id, token);
              if (pre) await activatePaidAccess(admin, pre, "recurring_payment");
            } else if (paymentStatus === "rejected" || ap.status === "cancelled") {
              // Não suspender aqui — MP fará retentativas (recycling). Suspensão só via preapproval.
              console.warn(`[MP webhook] authorized_payment ${ap.id} rejeitado (payment=${paymentStatus}, ap=${ap.status})`);
            } else {
              console.log(`[MP webhook] authorized_payment ${ap.id} intermediário (payment=${paymentStatus}, ap=${ap.status})`);
            }
            return Response.json({ ok: true, payment_status: paymentStatus, ap_status: ap.status });
          }

          // --- 3) Outros tópicos (payment, merchant_order, plan, etc.) ---------
          // Ignoramos porque não afetam o ciclo de assinatura. Retornar 200 para
          // o MP não reenviar infinitamente.
          console.log(`[MP webhook] ignorando tópico não mapeado: "${rawType}"`);
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
