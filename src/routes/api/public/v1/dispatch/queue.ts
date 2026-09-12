import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";
import { buildQueue } from "@/lib/api-public/dispatch.server";

const QueueSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  state: z.string().trim().toUpperCase().max(2).optional(),
  city: z.string().trim().max(120).optional(),
  niche: z.string().trim().max(80).optional(),
});

export const Route = createFileRoute("/api/public/v1/dispatch/queue")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      GET: async ({ request }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(
          request,
          async (ctx) => {
            const url = new URL(request.url);
            const parsed = QueueSchema.safeParse(
              Object.fromEntries(url.searchParams),
            );
            if (!parsed.success) {
              return errorJson(
                422,
                "validation_error",
                parsed.error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; "),
              );
            }

            const items = await buildQueue(
              ctx.admin,
              ctx.orgId,
              ctx.createdBy,
              parsed.data,
            );

            return json({
              data: items,
              count: items.length,
              user_id: ctx.createdBy,
            });
          },
        ),
    },
  },
});
