import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withApiAuth } from "@/lib/api-public/auth.server";
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";

const InteractionSchema = z.object({
  type: z.enum(["nota", "ligacao", "whatsapp", "email", "reuniao", "outro"]),
  content: z.string().trim().min(1).max(4000),
  author: z.string().trim().max(120).optional(),
});

export const Route = createFileRoute("/api/public/v1/clients/$id/interactions")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      GET: async ({ request, params }) =>
        withApiAuth(request, async (ctx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: client } = await (ctx.admin as any)
            .from("clients")
            .select("id")
            .eq("id", params.id)
            .eq("organization_id", ctx.orgId)
            .maybeSingle();
          if (!client) return errorJson(404, "not_found", "Client not found.");

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (ctx.admin as any)
            .from("client_events")
            .select("id, type, payload, user_id, created_at")
            .eq("client_id", params.id)
            .eq("organization_id", ctx.orgId)
            .order("created_at", { ascending: false })
            .limit(100);
          if (error) return errorJson(500, "db_error", error.message);
          return json({ data });
        }),

      POST: async ({ request, params }) =>
        withApiAuth(request, async (ctx) => {
          let body: unknown;
          try { body = await request.json(); }
          catch { return errorJson(400, "invalid_json", "Body must be valid JSON."); }

          const parsed = InteractionSchema.safeParse(body);
          if (!parsed.success) {
            return errorJson(422, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: client } = await (ctx.admin as any)
            .from("clients")
            .select("id")
            .eq("id", params.id)
            .eq("organization_id", ctx.orgId)
            .maybeSingle();
          if (!client) return errorJson(404, "not_found", "Client not found.");

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (ctx.admin as any)
            .from("client_events")
            .insert({
              client_id: params.id,
              organization_id: ctx.orgId,
              user_id: ctx.createdBy,
              type: `api:${parsed.data.type}`,
              payload: {
                content: parsed.data.content,
                author: parsed.data.author ?? "API",
                source: "api",
              },
            })
            .select()
            .single();
          if (error) return errorJson(500, "db_error", error.message);
          return json({ data }, { status: 201 });
        }),
    },
  },
});