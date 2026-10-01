import { createFileRoute } from "@tanstack/react-router";

/**
 * Enriquecimento automático em background (cron a cada 1 minuto, 20 leads).
 * Não depende de aba aberta.
 */
export const Route = createFileRoute("/api/public/hooks/enrich-batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let limit = 20;
        try {
          const body = (await request.json()) as { limit?: number } | null;
          if (body?.limit && Number.isFinite(body.limit)) {
            limit = Math.min(Math.max(Math.trunc(body.limit), 1), 40);
          }
        } catch {
          /* corpo vazio = padrão 20 */
        }

        try {
          const { enrichPendingBatch } = await import("@/lib/enrichment/pipeline.server");
          const result = await enrichPendingBatch(limit);
          return Response.json({ ...result, ok: true });
        } catch (err) {
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
