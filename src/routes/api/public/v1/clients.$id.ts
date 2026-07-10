import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
// withApiAuth is loaded lazily inside handlers to keep server-only code out of the client bundle
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";

const PIPELINE_STAGES = [
  "PROSPECCAO", "CADENCIA", "FECHADO", "REUNIAO_INICIAL", "PROPOSTA",
  "CONTRATO", "ASSINATURA", "PAGAMENTO_CONFIRMADO", "IMPLANTACAO",
  "ATIVO", "CHURNED", "PERDIDO",
] as const;

const PatchSchema = z.object({
  company: z.string().trim().min(1).max(200).optional(),
  contact_name: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(200).optional(),
  segment: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(20).optional(),
  owner_name: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
  pipeline_stage: z.enum(PIPELINE_STAGES).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: "At least one field is required." });

export const Route = createFileRoute("/api/public/v1/clients/$id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      GET: async ({ request, params }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(request, async (ctx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (ctx.admin as any)
            .from("clients")
            .select("*")
            .eq("id", params.id)
            .eq("organization_id", ctx.orgId)
            .maybeSingle();
          if (error) return errorJson(500, "db_error", error.message);
          if (!data) return errorJson(404, "not_found", "Client not found.");
          return json({ data });
        }),

      PATCH: async ({ request, params }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(request, async (ctx) => {
          let body: unknown;
          try { body = await request.json(); }
          catch { return errorJson(400, "invalid_json", "Body must be valid JSON."); }

          const parsed = PatchSchema.safeParse(body);
          if (!parsed.success) {
            return errorJson(422, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (ctx.admin as any)
            .from("clients")
            .update(parsed.data)
            .eq("id", params.id)
            .eq("organization_id", ctx.orgId)
            .select()
            .maybeSingle();
          if (error) return errorJson(500, "db_error", error.message);
          if (!data) return errorJson(404, "not_found", "Client not found.");
          return json({ data });
        }),
    },
  },
});