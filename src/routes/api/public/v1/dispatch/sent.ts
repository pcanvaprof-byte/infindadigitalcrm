import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";
import {
  getProspect,
  hasExternalId,
  recordSent,
  DISPATCH_CHANNELS,
} from "@/lib/api-public/dispatch.server";

const SentSchema = z.object({
  prospect_id: z.string().uuid(),
  channel: z.enum(DISPATCH_CHANNELS).default("whatsapp"),
  message: z.string().max(4000).optional(),
  external_id: z.string().max(200).optional(),
  sent_at: z.string().datetime().optional(),
});

export const Route = createFileRoute("/api/public/v1/dispatch/sent")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      POST: async ({ request }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(
          request,
          async (ctx) => {
            let body: unknown;
            try { body = await request.json(); }
            catch { return errorJson(400, "invalid_json", "Body must be valid JSON."); }

            const parsed = SentSchema.safeParse(body);
            if (!parsed.success) {
              return errorJson(422, "validation_error",
                parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
            }

            const prospect = await getProspect(ctx.admin, ctx.orgId, parsed.data.prospect_id);
            if (!prospect) {
              return errorJson(404, "not_found", "Prospect not found or does not belong to your organization.");
            }

            if (parsed.data.external_id) {
              const alreadySent = await hasExternalId(
                ctx.admin, ctx.createdBy, prospect.id, parsed.data.external_id);
              if (alreadySent) {
                return json({ idempotent: true, message: "Dispatch already recorded for this external_id." });
              }
            }

            const tp = await recordSent(ctx.admin, {
              orgId: ctx.orgId,
              userId: ctx.createdBy,
              prospectId: prospect.id,
              channel: parsed.data.channel,
              message: parsed.data.message ?? null,
              externalId: parsed.data.external_id ?? null,
              sentAt: parsed.data.sent_at ?? null,
            });

            return json({ id: tp.id, enviado_em: tp.enviado_em }, { status: 201 });
          },
        ),
    },
  },
});
