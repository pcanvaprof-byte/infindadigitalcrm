import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
// withApiAuth is loaded lazily inside handlers to keep server-only code out of the client bundle
import { errorJson, json, optionsResponse } from "@/lib/api-public/cors";

// "Tasks" mapped to cad_leads next_action_at (cadência do dia)
const CreateTaskSchema = z.object({
  empresa: z.string().trim().min(1).max(200),
  responsavel: z.string().trim().max(200).optional(),
  telefone: z.string().trim().max(40).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(200).optional(),
  next_action_at: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const Route = createFileRoute("/api/public/v1/tasks")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      GET: async ({ request }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(request, async (ctx) => {
          const url = new URL(request.url);
          const due = url.searchParams.get("due"); // "today" | "overdue" | ISO date
          const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query = (ctx.admin as any)
            .from("cad_leads")
            .select("id, empresa, responsavel, telefone, whatsapp, email, stage, temperatura, next_action_at, last_contact_at, notes")
            .eq("organization_id", ctx.orgId)
            .is("closed_at", null)
            .order("next_action_at", { ascending: true, nullsFirst: false })
            .limit(limit);

          const now = new Date();
          if (due === "today") {
            const end = new Date(now); end.setHours(23, 59, 59, 999);
            query = query.lte("next_action_at", end.toISOString());
          } else if (due === "overdue") {
            query = query.lt("next_action_at", now.toISOString());
          } else if (due) {
            const d = new Date(due);
            if (!isNaN(d.getTime())) query = query.lte("next_action_at", d.toISOString());
          }

          const { data, error } = await query;
          if (error) return errorJson(500, "db_error", error.message);
          return json({ data });
        }),

      POST: async ({ request }) =>
        (await import("@/lib/api-public/auth.server")).withApiAuth(request, async (ctx) => {
          let body: unknown;
          try { body = await request.json(); }
          catch { return errorJson(400, "invalid_json", "Body must be valid JSON."); }

          const parsed = CreateTaskSchema.safeParse(body);
          if (!parsed.success) {
            return errorJson(422, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
          }

          const nextAt = parsed.data.next_action_at ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (ctx.admin as any)
            .from("cad_leads")
            .insert({
              organization_id: ctx.orgId,
              owner_id: ctx.createdBy,
              empresa: parsed.data.empresa,
              responsavel: parsed.data.responsavel,
              telefone: parsed.data.telefone,
              whatsapp: parsed.data.whatsapp,
              email: parsed.data.email,
              notes: parsed.data.notes,
              stage: "followup_1",
              primeira_abordagem_at: new Date().toISOString(),
              next_action_at: nextAt,
            })
            .select()
            .single();
          if (error) return errorJson(500, "db_error", error.message);
          return json({ data }, { status: 201 });
        }),
    },
  },
});