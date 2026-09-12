import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";
import {
  getProspect,
  recordReply,
  DISPATCH_STATUSES,
} from "@/lib/api-public/dispatch.server";

const ReplySchema = z.object({
  prospect_id: z.string().uuid(),
  text: z.string().min(1).max(4000),
  received_at: z.string().datetime().optional(),
  status: z.enum(DISPATCH_STATUSES).optional(),
});

export const Route = createFileRoute("/api/public/v1/dispatch/reply")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      POST: async ({ request }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(
          request,
          async (ctx) => {
            let body: unknown;
            try {
              body = await request.json();
            } catch {
              return errorJson(400, "invalid_json", "Body must be valid JSON.");
            }

            const parsed = ReplySchema.safeParse(body);
            if (!parsed.success) {
              return errorJson(
                422,
                "validation_error",
                parsed.error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; "),
              );
            }

            const prospect = await getProspect(
              ctx.admin,
              ctx.orgId,
              parsed.data.prospect_id,
            );
            if (!prospect) {
              return errorJson(
                404,
                "not_found",
                "Prospect not found or does not belong to your organization.",
              );
            }

            const tp = await recordReply(ctx.admin, {
              orgId: ctx.orgId,
              userId: ctx.createdBy,
              prospectId: prospect.id,
              text: parsed.data.text,
              receivedAt: parsed.data.received_at ?? null,
              status: parsed.data.status ?? null,
            });

            return json(
              { id: tp.id, enviado_em: tp.enviado_em },
              { status: 201 },
            );
          },
        ),
    },
  },
});
