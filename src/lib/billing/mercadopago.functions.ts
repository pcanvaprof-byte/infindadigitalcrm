import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const MP_API = "https://api.mercadopago.com";
const PLAN_AMOUNT_BRL = 200;

function currentOrigin(): string {
  try {
    const req = getRequest();
    const url = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
    return `${proto}://${host}`;
  } catch {
    return "https://infindadigital.lovable.app";
  }
}

/**
 * Cria uma assinatura recorrente (preapproval) no Mercado Pago para o usuário atual.
 * Retorna a URL de checkout (init_point) para redirecionamento.
 */
export const createMercadoPagoSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");

    const userId = context.userId as string;
    const claims = (context.claims ?? {}) as { email?: string };
    const email =
      claims.email ??
      (context as unknown as { user?: { email?: string } }).user?.email ??
      "";
    if (!email) throw new Error("Usuário sem email — impossível criar assinatura.");

    const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
    const admin = createOwnSupabaseAdminClient() as AnyClient;

    const { data: access } = await admin
      .from("user_access")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    const orgId = (access?.organization_id as string | null) ?? null;

    const origin = currentOrigin();
    const externalReference = `${userId}|${orgId ?? "none"}`;

    const payload = {
      reason: "INFINDA — Plano Único (mensal)",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PLAN_AMOUNT_BRL,
        currency_id: "BRL",
      },
      payer_email: email,
      back_url: `${origin}/assinatura?mp=ok`,
      external_reference: externalReference,
      status: "pending",
    };

    const resp = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await resp.text();
    if (!resp.ok) {
      console.error(`[MP] preapproval failed [${resp.status}]: ${body}`);
      throw new Error(`Falha ao criar assinatura no Mercado Pago (${resp.status}).`);
    }
    const parsed = JSON.parse(body) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      status?: string;
    };
    const initPoint = parsed.init_point ?? parsed.sandbox_init_point;
    if (!initPoint) throw new Error("Mercado Pago não retornou init_point.");

    try {
      await admin.from("user_access_events").insert({
        user_id: userId,
        organization_id: orgId,
        event: "MP_PREAPPROVAL_CREATED",
        meta: {
          preapproval_id: parsed.id,
          status: parsed.status,
          amount: PLAN_AMOUNT_BRL,
        },
      });
    } catch { /* noop */ }

    return { initPoint, preapprovalId: parsed.id ?? null };
  });
