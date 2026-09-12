import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";
import {
  getProspect,
  resolveTemplate,
  personalize,
  contactNameFor,
} from "@/lib/api-public/dispatch.server";

const MessageSchema = z.object({
  prospect_id: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/v1/dispatch/message")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      GET: async ({ request }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(
          request,
          async (ctx) => {
            const url = new URL(request.url);
            const parsed = MessageSchema.safeParse(
              Object.fromEntries(url.searchParams),
            );
            if (!parsed.success) {
              return errorJson(422, "validation_error",
                parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
            }

            const prospect = await getProspect(ctx.admin, ctx.orgId, parsed.data.prospect_id);
            if (!prospect) {
              return errorJson(404, "not_found", "Prospect not found or does not belong to your organization.");
            }

            const template = await resolveTemplate(ctx.admin, ctx.orgId);
            const contactName = await contactNameFor(ctx.admin, prospect.id);
            const message = personalize(template, prospect, contactName);

            return json({ prospect_id: prospect.id, message });
          },
        ),
    },
  },
});
