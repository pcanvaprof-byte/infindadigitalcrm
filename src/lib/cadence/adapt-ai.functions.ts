import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  source_pack_key: z.string().min(1),
  new_pack_key: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/, "use apenas letras minúsculas, números e _"),
  nome: z.string().min(2).max(120),
  segmento: z.string().min(2).max(120),
  categoria: z.string().default("custom"),
  descricao: z.string().optional().default(""),
});

const STAGES = [
  "followup_1","followup_2","followup_3","followup_4","followup_5","followup_6","followup_7",
  "interessado","reuniao_agendada","proposta_enviada","negociacao","fechado","perdido",
] as const;

type StageKey = typeof STAGES[number];
type TplItem = { stage: StageKey; titulo: string; corpo: string };

/**
 * Adapta um pack existente para um segmento específico via IA.
 * - Carrega os 13 templates do pack de origem (respeitando RLS do usuário).
 * - Reescreve título+corpo de cada etapa para o segmento informado.
 * - Cria novo pack (org, is_system=false) com as mensagens adaptadas.
 */
export const adaptarPackComIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY ausente no servidor");

    const { supabase } = context;

    const { data: rows, error } = await supabase
      .rpc("cad_get_pack_templates", { _pack_key: data.source_pack_key });
    if (error) throw new Error(`Falha ao carregar pack origem: ${error.message}`);
    const items = (rows ?? []) as TplItem[];
    if (items.length === 0) throw new Error("Pack origem vazio");

    const prompt = `Você é um copywriter de vendas B2B especializado em cadências no WhatsApp.
Adapte as mensagens abaixo para o segmento "${data.segmento}".

REGRAS OBRIGATÓRIAS:
- Preserve exatamente as variáveis {{responsavel}}, {{empresa}}, {{cidade}}, {{segmento}}, {{telefone}}, {{cargo}} — não invente novas.
- Português BR, tom consultivo, curto, direto, sem exageros.
- Mantenha o mesmo objetivo/estágio de cada mensagem original.
- Retorne SOMENTE JSON válido no formato: {"items":[{"stage":"<stage>","titulo":"...","corpo":"..."}]}

Mensagens originais:
${JSON.stringify(items, null, 2)}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.5,
        messages: [
          { role: "system", content: "Você retorna apenas JSON válido, sem texto extra." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`IA falhou (${res.status}): ${txt.slice(0, 200)}`);
    }
    const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    let parsed: { items?: TplItem[] };
    try { parsed = JSON.parse(raw); } catch { throw new Error("Resposta IA inválida"); }
    const adapted = (parsed.items ?? []).filter(
      (i) => i && typeof i.stage === "string" && STAGES.includes(i.stage as StageKey),
    );
    if (adapted.length === 0) throw new Error("IA não retornou mensagens válidas");

    // Cria pack novo com as adaptações
    const { error: createErr } = await supabase.rpc("cad_create_pack_with_templates", {
      _pack_key: data.new_pack_key,
      _nome: data.nome,
      _descricao: data.descricao || `Adaptação IA para ${data.segmento}`,
      _categoria: data.categoria || "custom",
      _icon: "Sparkles",
      _items: adapted as unknown as object,
    });
    if (createErr) throw new Error(`Falha ao criar pack: ${createErr.message}`);

    // Atualiza segmento/tags via meta
    await supabase.rpc("cad_update_pack_meta", {
      _pack_key: data.new_pack_key,
      _nome: data.nome,
      _descricao: data.descricao || `Adaptação IA para ${data.segmento}`,
      _categoria: data.categoria || "custom",
      _icon: "Sparkles",
      _objetivo: `Prospectar ${data.segmento}`,
      _segmento: data.segmento,
      _tags: ["ia", data.segmento.toLowerCase()],
    });

    return { ok: true, pack_key: data.new_pack_key, count: adapted.length };
  });