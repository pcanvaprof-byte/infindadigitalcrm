import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  area: z.enum(["comercial", "financeiro", "marketing", "operacoes", "diretoria"]),
});

/**
 * Gera insights de BI usando IA (Groq) sobre o payload do bi_dashboard(area).
 * Persiste em ai_insights (RLS por org). Falha graciosamente se a chave faltar.
 */
export const gerarInsightBI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as {
      rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      };
    };

    // 1) carrega payload do dashboard (respeita RLS do usuário)
    const { data: payload, error } = await sb.rpc("bi_dashboard", { p_area: data.area });
    if (error) throw new Error(`bi_dashboard: ${error.message}`);

    // 2) descobre org ativa
    const { data: orgId } = await sb.rpc("current_org_id");
    if (!orgId) throw new Error("Organização ativa não definida");

    // 3) chama IA (Groq) — fallback determinístico se a chave não estiver presente
    const apiKey = process.env.GROQ_API_KEY;
    let summary = "";
    let recommendations: string[] = [];
    let model = "fallback";

    const prompt = `Você é um analista de BI da INFINDA Digital. Analise os dados abaixo da área "${data.area}" e gere uma resposta em JSON estrito (sem markdown), formato:
{"summary":"texto curto em português destacando padrões, oportunidades e riscos (até 6 linhas)","recommendations":["recomendação 1","recomendação 2","recomendação 3"]}.

Dados:
${JSON.stringify(payload, null, 2)}`;

    if (apiKey) {
      try {
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "Você responde sempre em JSON válido em português." },
              { role: "user", content: prompt },
            ],
          }),
        });
        if (resp.ok) {
          const j = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const content = j.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(content) as { summary?: string; recommendations?: string[] };
          summary = parsed.summary ?? "";
          recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
          model = "groq:llama-3.3-70b-versatile";
        }
      } catch (e) {
        console.warn("IA insights falhou, usando fallback", e);
      }
    }

    if (!summary) {
      summary = `Análise automática (sem IA) da área ${data.area}: dados consolidados disponíveis no painel.`;
      recommendations = [
        "Revisar manualmente os indicadores destacados",
        "Configurar GROQ_API_KEY para análises automáticas detalhadas",
      ];
    }

    // 4) persiste
    const { data: inserted, error: insErr } = await sb
      .from("ai_insights")
      .insert({
        organization_id: orgId as string,
        area: data.area,
        scope: "geral",
        payload: payload ?? {},
        summary,
        recommendations,
        model,
        created_by: userId,
      })
      .select("id,summary,recommendations,created_at,area")
      .single();
    if (insErr) throw new Error(insErr.message);

    return inserted;
  });