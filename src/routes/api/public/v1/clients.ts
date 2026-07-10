import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
// withApiAuth is loaded lazily inside handlers to keep server-only code out of the client bundle
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";

const PIPELINE_STAGES = [
  "PROSPECCAO", "CADENCIA", "FECHADO", "REUNIAO_INICIAL", "PROPOSTA",
  "CONTRATO", "ASSINATURA", "PAGAMENTO_CONFIRMADO", "IMPLANTACAO",
  "ATIVO", "CHURNED", "PERDIDO",
] as const;

const CreateClientSchema = z.object({
  company: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().max(200).optional(),
  cnpj: z.string().trim().max(20).optional(),
  segment: z.string().trim().max(120).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(200).optional(),
  instagram: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(20).optional(),
  owner_name: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
  pipeline_stage: z.enum(PIPELINE_STAGES).optional(),
});

export const Route = createFileRoute("/api/public/v1/clients")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      GET: async ({ request }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(request, async (ctx) => {
          const url = new URL(request.url);
          const rawQ = url.searchParams.get("q");
          // Strip PostgREST filter-grammar control characters (comma, parens,
          // dot, quote, backslash) and cap length to prevent filter injection
          // into the .or() clause below.
          const q = rawQ
            ? rawQ.replace(/[,()"\\.]/g, " ").trim().slice(0, 100)
            : null;
          const status = url.searchParams.get("status");
          const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
          const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query = (ctx.admin as any)
            .from("clients")
            .select("id, company, contact_name, cnpj, segment, whatsapp, phone, email, city, state, owner_name, pipeline_stage, financial_status, tags, notes, created_at, updated_at")
            .eq("organization_id", ctx.orgId)
            .order("updated_at", { ascending: false })
            .range(offset, offset + limit - 1);

          if (q) {
            query = query.or(
              `company.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%`,
            );
          }
          if (status) query = query.eq("pipeline_stage", status);

          const { data, error } = await query;
          if (error) return errorJson(500, "db_error", error.message);
          return json({ data, limit, offset, count: data?.length ?? 0 });
        }),

      POST: async ({ request }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(request, async (ctx) => {
          let body: unknown;
          try { body = await request.json(); }
          catch { return errorJson(400, "invalid_json", "Body must be valid JSON."); }

          const parsed = CreateClientSchema.safeParse(body);
          if (!parsed.success) {
            return errorJson(422, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (ctx.admin as any)
            .from("clients")
            .insert({
              ...parsed.data,
              organization_id: ctx.orgId,
              user_id: ctx.createdBy,
            })
            .select()
            .single();

          if (error) return errorJson(500, "db_error", error.message);
          return json({ data }, { status: 201 });
        }),
    },
  },
});