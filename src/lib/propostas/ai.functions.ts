import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  proposalId: z.string().uuid(),
  contexto: z.string().max(2000).optional(),
});

const ContentSchema = z.object({
  diagnostico: z.string().default(""),
  problemas: z.array(z.string()).default([]),
  solucao: z.string().default(""),
  cronograma: z.string().default(""),
  observacoes: z.string().default(""),
});

export type GeneratedContent = z.infer<typeof ContentSchema>;

/**
 * Gera conteúdo de proposta (diagnóstico, solução, cronograma...) usando Groq.
 * Lê a proposta + itens do catálogo + dados do cliente/lead via Supabase do usuário (RLS).
 */
export const gerarConteudoProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY ausente");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const { data: prop, error: pErr } = await sb
      .from("proposals")
      .select("id, titulo, valor_implantacao, valor_mensal, valor_avulso, validade_dias, client_id, lead_id, deal_id")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prop) throw new Error("Proposta não encontrada");

    const { data: items } = await sb
      .from("proposal_items")
      .select("nome, descricao, categoria, area, cobranca, quantidade, valor_unitario, valor_total, prazo_dias, entregaveis")
      .eq("proposal_id", data.proposalId)
      .order("ordem");

    let cliente: Record<string, unknown> | null = null;
    if (prop.client_id) {
      const { data: c } = await sb
        .from("clients")
        .select("company, contact_name, segment, city, state, notes")
        .eq("id", prop.client_id)
        .maybeSingle();
      cliente = c ?? null;
    }
    let lead: Record<string, unknown> | null = null;
    if (!cliente && prop.lead_id) {
      const { data: l } = await sb
        .from("prospects")
        .select("company, owner, segment, notes")
        .eq("id", prop.lead_id)
        .maybeSingle();
      lead = l ?? null;
    }

    const ctxAlvo = cliente ?? lead ?? {};
    const itensTxt = ((items ?? []) as Array<Record<string, unknown>>)
      .map(
        (it: Record<string, unknown>) =>
          `- ${it.nome} (${it.cobranca}, qtd ${it.quantidade}, R$ ${Number(it.valor_total).toFixed(2)})${
            it.descricao ? ` — ${it.descricao}` : ""
          }`,
      )
      .join("\n");

    const prompt = `Você é um consultor estratégico sênior da INFINDA Digital escrevendo uma proposta comercial em português do Brasil.
Gere o conteúdo da proposta abaixo, estritamente em JSON válido seguindo este schema:
{
  "diagnostico": "texto corrido, 2-4 parágrafos sobre o cenário e contexto do cliente",
  "problemas": ["dor 1", "dor 2", "dor 3", "dor 4"],
  "solucao": "texto corrido, 2-4 parágrafos descrevendo a solução e como ela resolve as dores, citando os itens contratados",
  "cronograma": "texto curto descrevendo as fases e prazos estimados (use marcadores com hífen)",
  "observacoes": "condições comerciais, validade, formas de pagamento e próximos passos"
}

Dados do cliente/lead:
${JSON.stringify(ctxAlvo, null, 2)}

Título da proposta: ${prop.titulo}
Validade: ${prop.validade_dias} dias
Valores: implantação R$ ${Number(prop.valor_implantacao).toFixed(2)} | mensal R$ ${Number(prop.valor_mensal).toFixed(2)}/mês | avulso R$ ${Number(prop.valor_avulso).toFixed(2)}

Itens contratados:
${itensTxt || "(nenhum item selecionado ainda — escreva de forma genérica baseada no contexto)"}

${data.contexto ? `Contexto adicional do vendedor: ${data.contexto}` : ""}

Responda APENAS com o objeto JSON, sem markdown, sem comentários, sem texto fora do JSON.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você é um consultor sênior. Escreva proposta comercial em PT-BR, objetiva, persuasiva e específica ao contexto. Responda apenas em JSON válido conforme o schema.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Groq ${res.status}: ${t.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("Resposta IA vazia");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("IA não retornou JSON");
      parsed = JSON.parse(m[0]);
    }
    const content = ContentSchema.parse(parsed);
    return content;
  });