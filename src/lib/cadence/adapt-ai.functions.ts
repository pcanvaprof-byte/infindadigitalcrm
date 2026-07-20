import { createServerFn } from "@tanstack/react-start";
import { authWithAccess } from "@/lib/access/auth-with-access";
import { z } from "zod";

/** Briefing rico opcional — quando não vier, cai no modo simples (só segmento). */
const Briefing = z.object({
  tom: z.enum(["consultivo", "formal", "casual", "provocativo", "amigavel"]).optional(),
  objetivo: z.string().max(400).optional(),
  publico_alvo: z.string().max(400).optional(),
  dor_principal: z.string().max(400).optional(),
  proposta_valor: z.string().max(400).optional(),
  diferenciais: z.string().max(400).optional(),
  cta_preferido: z.string().max(200).optional(),
  restricoes: z.string().max(400).optional(),
  observacoes: z.string().max(600).optional(),
}).partial();

const Input = z.object({
  source_pack_key: z.string().min(1),
  segmento: z.string().min(2).max(120),
  briefing: Briefing.optional(),
  // preview: apenas devolve os itens adaptados sem persistir
  preview: z.boolean().optional().default(false),
  // Campos exigidos apenas quando preview=false (para persistir)
  new_pack_key: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/, "use apenas letras minúsculas, números e _").optional(),
  nome: z.string().min(2).max(120).optional(),
  categoria: z.string().optional().default("custom"),
  descricao: z.string().optional().default(""),
  // Quando o cliente já editou o preview, pode enviar os items para persistência direta
  items_override: z.array(z.object({
    stage: z.string(),
    titulo: z.string().default(""),
    corpo: z.string().default(""),
  })).optional(),
});

const STAGES = [
  "followup_1","followup_2","followup_3","followup_4","followup_5","followup_6","followup_7",
  "interessado","reuniao_agendada","proposta_enviada","negociacao","fechado","perdido",
] as const;

type StageKey = typeof STAGES[number];
type TplItem = { stage: StageKey; titulo: string; corpo: string };

function buildBriefingBlock(b?: z.infer<typeof Briefing>) {
  if (!b) return "";
  const lines: string[] = [];
  if (b.tom) lines.push(`- Tom de voz: ${b.tom}`);
  if (b.objetivo) lines.push(`- Objetivo da cadência: ${b.objetivo}`);
  if (b.publico_alvo) lines.push(`- Público-alvo: ${b.publico_alvo}`);
  if (b.dor_principal) lines.push(`- Dor principal do cliente: ${b.dor_principal}`);
  if (b.proposta_valor) lines.push(`- Proposta de valor: ${b.proposta_valor}`);
  if (b.diferenciais) lines.push(`- Diferenciais: ${b.diferenciais}`);
  if (b.cta_preferido) lines.push(`- CTA preferido: ${b.cta_preferido}`);
  if (b.restricoes) lines.push(`- Restrições (evitar): ${b.restricoes}`);
  if (b.observacoes) lines.push(`- Observações: ${b.observacoes}`);
  return lines.length ? `\nBRIEFING DO CLIENTE:\n${lines.join("\n")}\n` : "";
}

/** Mescla o perfil do negócio (memória global da org) com o briefing informado no fluxo.
 *  Regra: o briefing manual do usuário SEMPRE prevalece; o perfil só preenche lacunas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mergeWithBusinessProfile(supabase: any, b?: z.infer<typeof Briefing>) {
  let profile: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase
      .from("business_profiles")
      .select("niche, audience, tone, focus, approach, pains, benefits, differentials, product")
      .eq("org_id", (await supabase.rpc("current_org_id")).data ?? null)
      .maybeSingle();
    profile = data ?? null;
  } catch {
    profile = null;
  }
  if (!profile) return b ?? {};
  const merged: z.infer<typeof Briefing> = { ...(b ?? {}) };
  const tone = String(profile.tone ?? "").toLowerCase();
  if (!merged.tom) {
    if (tone.includes("consult")) merged.tom = "consultivo";
    else if (tone.includes("form")) merged.tom = "formal";
    else if (tone.includes("prov")) merged.tom = "provocativo";
    else if (tone.includes("amig") || tone.includes("próx") || tone.includes("prox")) merged.tom = "amigavel";
    else if (tone.includes("descontr") || tone.includes("casual")) merged.tom = "casual";
  }
  if (!merged.publico_alvo && profile.audience) merged.publico_alvo = String(profile.audience);
  if (!merged.dor_principal && Array.isArray(profile.pains) && profile.pains.length)
    merged.dor_principal = (profile.pains as string[]).slice(0, 3).join("; ");
  if (!merged.proposta_valor && profile.focus) merged.proposta_valor = String(profile.focus);
  if (!merged.diferenciais && profile.differentials) merged.diferenciais = String(profile.differentials);
  if (!merged.observacoes) {
    const bits: string[] = [];
    if (profile.niche) bits.push(`Nicho: ${profile.niche}`);
    if (profile.product) bits.push(`Produto/serviço: ${profile.product}`);
    if (profile.approach) bits.push(`Abordagem sugerida: ${profile.approach}`);
    if (Array.isArray(profile.benefits) && profile.benefits.length)
      bits.push(`Benefícios: ${(profile.benefits as string[]).slice(0, 5).join("; ")}`);
    if (bits.length) merged.observacoes = bits.join(" | ").slice(0, 600);
  }
  return merged;
}

/**
 * Adapta um pack existente com base em segmento + briefing opcional (tom, objetivo, dor, etc.).
 * - `preview=true`  → retorna { items } sem persistir (para o usuário revisar/editar).
 * - `preview=false` → cria novo pack. Se `items_override` vier preenchido, usa-os direto (usuário editou); caso contrário roda IA.
 */
export const adaptarPackComIA = createServerFn({ method: "POST" })
  .middleware([authWithAccess])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let adapted: TplItem[] = [];

    // Se o cliente já enviou items editados (fluxo: preview → editar → salvar), usa direto.
    if (data.items_override && data.items_override.length > 0 && !data.preview) {
      adapted = data.items_override
        .filter((i) => STAGES.includes(i.stage as StageKey))
        .map((i) => ({ stage: i.stage as StageKey, titulo: i.titulo ?? "", corpo: i.corpo ?? "" }));
    } else {
      const { data: rows, error } = await supabase
        .rpc("cad_get_pack_templates", { _pack_key: data.source_pack_key });
      if (error) throw new Error(`Falha ao carregar pack origem: ${error.message}`);
      const items = (rows ?? []) as TplItem[];
      if (items.length === 0) throw new Error("Pack origem vazio");

      const mergedBriefing = await mergeWithBusinessProfile(supabase, data.briefing);
      const briefingBlock = buildBriefingBlock(mergedBriefing);
      const tom = mergedBriefing.tom ?? "consultivo";

      const prompt = `Você é um copywriter sênior de vendas B2B especializado em cadências no WhatsApp.
Adapte as 13 mensagens abaixo para o segmento "${data.segmento}", respeitando o briefing do cliente.

REGRAS OBRIGATÓRIAS:
- Preserve EXATAMENTE as variáveis {{responsavel}}, {{empresa}}, {{cidade}}, {{segmento}}, {{telefone}}, {{cargo}}, {{remetente}}, {{data_reuniao}} — não invente novas nem traduza.
- Português BR, tom ${tom}, curto, direto, sem clichês ("espero que este e-mail te encontre bem", "gostaria de aproveitar…"), sem emojis exagerados.
- Cada mensagem MANTÉM o mesmo objetivo/estágio original (follow-up N mantém intenção de follow-up N, etapa "reuniao_agendada" continua confirmando reunião, etc.).
- Nas mensagens de follow-up (followup_1..7), varie a abordagem: reforçar valor, quebrar objeção, prova social, urgência leve, última tentativa etc.
- Se o briefing mencionar CTA, use-o de forma natural nas etapas iniciais e nas de proposta.
- Retorne SOMENTE JSON válido no formato: {"items":[{"stage":"<stage>","titulo":"...","corpo":"..."}]}
${briefingBlock}
Mensagens originais:
${JSON.stringify(items, null, 2)}`;

      const { callGroqChat } = await import("@/lib/ai/groq-client.server");
      const raw = await callGroqChat({
        model: "llama-3.3-70b-versatile",
        temperature: 0.6,
        jsonMode: true,
        messages: [
          { role: "system", content: "Você retorna APENAS JSON válido, sem texto extra, sem markdown, sem crases." },
          { role: "user", content: prompt },
        ],
      });
      let parsed: { items?: TplItem[] };
      try { parsed = JSON.parse(raw || "{}"); } catch { throw new Error("Resposta IA inválida (JSON malformado)"); }
      adapted = (parsed.items ?? []).filter(
        (i) => i && typeof i.stage === "string" && STAGES.includes(i.stage as StageKey),
      );
      if (adapted.length === 0) throw new Error("IA não retornou mensagens válidas");
    }

    // Modo preview: só devolve os itens.
    if (data.preview) {
      return { ok: true, preview: true, items: adapted, count: adapted.length };
    }

    // Persistência
    if (!data.new_pack_key || !data.nome) {
      throw new Error("Para salvar é preciso informar new_pack_key e nome");
    }

    const { error: createErr } = await supabase.rpc("cad_create_pack_with_templates", {
      _pack_key: data.new_pack_key,
      _nome: data.nome,
      _descricao: data.descricao || `Adaptação IA para ${data.segmento}`,
      _categoria: data.categoria || "custom",
      _icon: "Sparkles",
      _items: adapted as unknown as never,
    });
    if (createErr) throw new Error(`Falha ao criar pack: ${createErr.message}`);

    const briefingSummary = data.briefing
      ? [data.briefing.tom, data.briefing.objetivo, data.briefing.publico_alvo].filter(Boolean).join(" · ")
      : "";

    await supabase.rpc("cad_update_pack_meta", {
      _pack_key: data.new_pack_key,
      _nome: data.nome,
      _descricao: data.descricao || `Adaptação IA para ${data.segmento}${briefingSummary ? ` — ${briefingSummary}` : ""}`,
      _categoria: data.categoria || "custom",
      _icon: "Sparkles",
      _objetivo: data.briefing?.objetivo || `Prospectar ${data.segmento}`,
      _segmento: data.segmento,
      _tags: ["ia", data.segmento.toLowerCase(), ...(data.briefing?.tom ? [data.briefing.tom] : [])],
    });

    return { ok: true, preview: false, pack_key: data.new_pack_key, count: adapted.length, items: adapted };
  });