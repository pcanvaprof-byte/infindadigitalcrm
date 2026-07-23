import { createServerFn } from "@tanstack/react-start";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/**
 * TESTE END-TO-END do webhook do Mercado Pago.
 * Simula uma preapproval `authorized` para o email informado, executando
 * a MESMA lógica do handler real (activatePaidAccess).
 * REMOVER após validação.
 */
export const simulateMpWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const { createOwnSupabaseAdminClient } = await import("@/lib/api-keys.server");
    const admin = createOwnSupabaseAdminClient() as AnyClient;

    // 1) Descobre userId pelo email (via auth.admin.listUsers).
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(`listUsers falhou: ${listErr.message}`);
    const user = (list?.users ?? []).find(
      (u: { email?: string }) => u.email?.toLowerCase() === data.email.toLowerCase(),
    );
    if (!user) throw new Error(`Usuário não encontrado: ${data.email}`);
    const userId = user.id as string;

    // 2) Estado ANTES.
    const { data: before } = await admin
      .from("user_access")
      .select("id, access_type, status, expires_at, organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    // 3) Executa a mesma lógica do webhook (activatePaidAccess inline).
    const preapproval = {
      id: `TEST-${Date.now()}`,
      status: "authorized",
      external_reference: `${userId}|${before?.organization_id ?? "none"}`,
    };
    const expiresAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();

    if (!before?.id) throw new Error(`user_access ausente para user ${userId}`);

    await admin
      .from("user_access")
      .update({ access_type: "paid", status: "active", expires_at: expiresAt })
      .eq("id", before.id);

    // Normaliza slug demo.
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
        preapproval_id: preapproval.id,
        preapproval_status: preapproval.status,
        expires_at: expiresAt,
        simulated: true,
      },
    });

    // 4) Estado DEPOIS.
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

    return { userId, email: data.email, before, after, slugFix, recentEvents: events };
  });