import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withApiAuth } from "@/lib/api-public/auth.server";
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";

const CreateProposalSchema = z.object({
  client_id: z.string().uuid(),
  titulo: z.string().trim().min(1).max(200),
  valor_implantacao: z.number().nonnegative().optional(),
  valor_mensal: z.number().nonnegative().optional(),
  valor_avulso: z.number().nonnegative().optional(),
  validade_dias: z.number().int().positive().max(365).optional(),
  escopo: z.string().trim().max(4000).optional(),
  prazo: z.string().trim().max(500).optional(),
});

export const Route = createFileRoute("/api/public/v1/proposals")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      POST: async ({ request }) =>
        withApiAuth(request, async (ctx) => {
          let body: unknown;
          try { body = await request.json(); }
          catch { return errorJson(400, "invalid_json", "Body must be valid JSON."); }

          const parsed = CreateProposalSchema.safeParse(body);
          if (!parsed.success) {
            return errorJson(422, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: client } = await (ctx.admin as any)
            .from("clients")
            .select("id")
            .eq("id", parsed.data.client_id)
            .eq("organization_id", ctx.orgId)
            .maybeSingle();
          if (!client) return errorJson(404, "client_not_found", "Client not found in your organization.");

          const validade = parsed.data.validade_dias ?? 15;
          const validUntil = new Date(Date.now() + validade * 24 * 3600 * 1000).toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (ctx.admin as any)
            .from("proposals")
            .insert({
              organization_id: ctx.orgId,
              user_id: ctx.createdBy,
              client_id: parsed.data.client_id,
              titulo: parsed.data.titulo,
              status: "rascunho",
              valor_implantacao: parsed.data.valor_implantacao ?? 0,
              valor_mensal: parsed.data.valor_mensal ?? 0,
              valor_avulso: parsed.data.valor_avulso ?? 0,
              validade_dias: validade,
              valid_until: validUntil,
              escopo: parsed.data.escopo,
              prazo: parsed.data.prazo,
            })
            .select()
            .single();
          if (error) return errorJson(500, "db_error", error.message);
          return json({ data }, { status: 201 });
        }),
    },
  },
});