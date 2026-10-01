import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authWithAccess } from "@/lib/access/auth-with-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const AI_MODEL = "llama-3.3-70b-versatile";

const InputsSchema = z.object({
  description: z.string().trim().max(2000).optional().default(""),
  product: z.string().trim().max(200).optional().default(""),
  ideal_customer: z.string().trim().max(200).optional().default(""),
  region: z.string().trim().max(200).optional().default(""),
  differentials: z.string().trim().max(2000).optional().default(""),
});

export type BusinessAiResult = {
  niche: string;
  audience: string;
  language: string;
  tone: string;
  focus: string;
  pains: string[];
  benefits: string[];
  triggers: string[];
  approach: string;
  initial_message: string;
};

async function getOrgId(supabase: AnyClient): Promise<string> {
  const { data, error } = await supabase.rpc("current_org_id");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem organização ativa");
  return data as string;
}

async function loadProfile(supabase: AnyClient, orgId: string, userId: string) {
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertProfile(
  supabase: AnyClient,
  orgId: string,
  userId: string,
  patch: Record<string, unknown>,
) {
  const existing = await loadProfile(supabase, orgId, userId);
  if (existing) {
    const { data, error } = await supabase
      .from("business_profiles")
      .update({ ...patch, updated_by: userId })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("business_profiles")
    .insert({
      org_id: orgId,
      user_id: userId,
      created_by: userId,
      updated_by: userId,
      ...patch,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export const getBusinessProfile = createServerFn({ method: "GET" })
  .middleware([authWithAccess])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (context as any).userId as string;
    const orgId = await getOrgId(supabase);
    const profile = await loadProfile(supabase, orgId, userId);
    return profile;
  });

export const saveBusinessInputs = createServerFn({ method: "POST" })
  .middleware([authWithAccess])
  .inputValidator((data: unknown) => InputsSchema.parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (context as any).userId as string;
    const orgId = await getOrgId(supabase);
    return upsertProfile(supabase, orgId, userId, {
      description: data.description || null,
      product: data.product || null,
      ideal_customer: data.ideal_customer || null,
      region: data.region || null,
      differentials: data.differentials || null,
    });
  });

function safeJsonParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // tenta extrair bloco json
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function asStringArray(v: unknown, max = 10): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => (x as string).trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeAi(raw: unknown): BusinessAiResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    niche: String(r.niche ?? r.nicho ?? "").trim().slice(0, 200),
    audience: String(r.audience ?? r.publico ?? "").trim().slice(0, 200),
    language: String(r.language ?? r.linguagem ?? "").trim().slice(0, 200),
    tone: String(r.tone ?? r.tom ?? "").trim().slice(0, 200),
    focus: String(r.focus ?? r.foco ?? "").trim().slice(0, 300),
    pains: asStringArray(r.pains ?? r.dores),
    benefits: asStringArray(r.benefits ?? r.beneficios),
    triggers: asStringArray(r.triggers ?? r.gatilhos),
    approach: String(r.approach ?? r.abordagem ?? "").trim().slice(0, 500),
    initial_message: String(r.initial_message ?? r.mensagem_inicial ?? "")
      .trim()
      .slice(0, 2000),
  };
}

async function callGroq(prompt: string, system: string): Promise<string> {
  const { callGroqChat } = await import("@/lib/ai/groq-client.server");
  return callGroqChat({
    model: AI_MODEL,
    temperature: 0.4,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
}

function buildAnalysisPrompt(inputs: {
  description?: string | null;
  product?: string | null;
  ideal_customer?: string | null;
  region?: string | null;
  differentials?: string | null;
}): string {
  return [
    "Analise o negócio abaixo e retorne APENAS um JSON válido (sem markdown, sem comentários).",
    "",
    "Campos obrigatórios do JSON:",
    "{",
    '  "niche": string (nicho identificado),',
    '  "audience": string (público-alvo principal),',
    '  "language": string (consultiva | direta | técnica | educativa | emocional),',
    '  "tone": string (profissional | próximo | premium | descontraído | autoridade),',
    '  "focus": string (principal argumento de venda em uma frase),',
    '  "pains": string[] (3 a 5 dores reais do público),',
    '  "benefits": string[] (3 a 5 benefícios concretos),',
    '  "triggers": string[] (3 a 5 gatilhos: economia, segurança, autoridade, escassez, prova social, etc),',
    '  "approach": string (tipo de abordagem comercial recomendada),',
    '  "initial_message": string (primeira mensagem de prospecção em PT-BR, 3-6 linhas, tom humano, sem clichês, sem emojis excessivos, terminando com uma pergunta aberta)',
    "}",
    "",
    "Dados informados:",
    `Descrição da empresa: ${inputs.description || "(não informado)"}`,
    `Produto/serviço: ${inputs.product || "(não informado)"}`,
    `Cliente ideal: ${inputs.ideal_customer || "(não informado)"}`,
    `Região: ${inputs.region || "(não informado)"}`,
    `Diferenciais: ${inputs.differentials || "(não informado)"}`,
  ].join("\n");
}

const SYSTEM_ANALYST =
  "Você é um consultor comercial sênior especializado em prospecção B2B/B2C no Brasil. Responda SEMPRE em português, com clareza e sem enrolação, retornando exclusivamente JSON válido conforme o schema pedido.";

export const analyzeBusinessWithAI = createServerFn({ method: "POST" })
  .middleware([authWithAccess])
  .inputValidator((data: unknown) => InputsSchema.parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (context as any).userId as string;
    const orgId = await getOrgId(supabase);

    if (!data.description && !data.product) {
      throw new Error("Informe ao menos a descrição da empresa ou o produto principal.");
    }

    // grava inputs primeiro
    await upsertProfile(supabase, orgId, userId, {
      description: data.description || null,
      product: data.product || null,
      ideal_customer: data.ideal_customer || null,
      region: data.region || null,
      differentials: data.differentials || null,
    });

    const raw = await callGroq(buildAnalysisPrompt(data), SYSTEM_ANALYST);
    const parsed = safeJsonParse(raw);
    if (!parsed) throw new Error("A IA não retornou JSON válido. Tente novamente.");
    const ai = normalizeAi(parsed);

    const saved = await upsertProfile(supabase, orgId, userId, {
      niche: ai.niche || null,
      audience: ai.audience || null,
      language: ai.language || null,
      tone: ai.tone || null,
      focus: ai.focus || null,
      pains: ai.pains,
      benefits: ai.benefits,
      triggers: ai.triggers,
      approach: ai.approach || null,
      initial_message: ai.initial_message || null,
      ai_model: AI_MODEL,
      analyzed_at: new Date().toISOString(),
    });

    return { ai, profile: saved };
  });

export const regenerateInitialMessage = createServerFn({ method: "POST" })
  .middleware([authWithAccess])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (context as any).userId as string;
    const orgId = await getOrgId(supabase);
    const p = await loadProfile(supabase, orgId, userId);
    if (!p) throw new Error("Perfil de negócio ainda não foi analisado.");

    const prompt = [
      "Gere UMA nova versão da primeira mensagem de prospecção, diferente da anterior.",
      "Retorne APENAS um JSON no formato: { \"initial_message\": string }",
      "Regras: PT-BR, 3-6 linhas, tom humano, sem clichês, sem 'espero que esteja bem', sem emojis excessivos, terminando com pergunta aberta.",
      "",
      `Nicho: ${p.niche || "-"}`,
      `Público: ${p.audience || "-"}`,
      `Tom: ${p.tone || "-"}`,
      `Linguagem: ${p.language || "-"}`,
      `Foco: ${p.focus || "-"}`,
      `Dores: ${(p.pains || []).join("; ") || "-"}`,
      `Benefícios: ${(p.benefits || []).join("; ") || "-"}`,
      `Gatilhos: ${(p.triggers || []).join("; ") || "-"}`,
      `Diferenciais: ${p.differentials || "-"}`,
      `Mensagem anterior (evite repetir): ${p.initial_message || "-"}`,
    ].join("\n");

    const raw = await callGroq(prompt, SYSTEM_ANALYST);
    const parsed = safeJsonParse<{ initial_message?: string }>(raw);
    const message = String(parsed?.initial_message ?? "").trim().slice(0, 2000);
    if (!message) throw new Error("A IA não retornou uma nova mensagem.");

    const saved = await upsertProfile(supabase, orgId, userId, {
      initial_message: message,
    });
    return { initial_message: message, profile: saved };
  });

const ConfirmInput = z.object({
  initial_message: z.string().trim().min(10).max(2000),
});

export const confirmBusinessProfile = createServerFn({ method: "POST" })
  .middleware([authWithAccess])
  .inputValidator((data: unknown) => ConfirmInput.parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (context as any).userId as string;
    const orgId = await getOrgId(supabase);
    const saved = await upsertProfile(supabase, orgId, userId, {
      initial_message: data.initial_message,
      onboarding_status: "completed",
    });
    return saved;
  });

/**
 * Regenera os `cad_templates` da organização (uma linha por stage) usando o
 * `business_profile` como contexto. Preserva `cad_messages` já enviadas —
 * cadências em andamento continuam com o conteúdo antigo já renderizado;
 * apenas mensagens futuras (novas renderizações) usam o texto novo.
 */
const STAGES = [
  "followup_1","followup_2","followup_3","followup_4","followup_5","followup_6","followup_7",
  "interessado","reuniao_agendada","proposta_enviada","negociacao","fechado","perdido",
] as const;
type Stage = typeof STAGES[number];

export const regenerateOrgCadTemplates = createServerFn({ method: "POST" })
  .middleware([authWithAccess])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (context as any).userId as string;
    const orgId = await getOrgId(supabase);
    const profile = await loadProfile(supabase, orgId, userId);
    if (!profile) throw new Error("Configure seu Negócio antes de regenerar os templates.");

    const prompt = [
      "Gere 13 mensagens de cadência comercial (WhatsApp/e-mail curto) em PT-BR para o negócio abaixo.",
      "Retorne SOMENTE JSON no formato:",
      '{ "items": [ { "stage": "<stage>", "titulo": string, "corpo": string } ] }',
      "",
      "Stages obrigatórios (uma mensagem por stage):",
      STAGES.map((s) => `- ${s}`).join("\n"),
      "",
      "REGRAS:",
      "- Preserve EXATAMENTE as variáveis {{responsavel}}, {{empresa}}, {{cidade}}, {{segmento}}, {{telefone}}, {{cargo}}, {{remetente}}, {{data_reuniao}}.",
      "- Sem clichês (ex.: 'espero que este e-mail te encontre bem'), sem emojis exagerados.",
      "- Cada 'corpo' entre 2 e 6 linhas, direto e humano.",
      "- followup_1..7 variam abordagem (valor, prova social, quebra de objeção, última tentativa).",
      "- 'interessado' engaja, 'reuniao_agendada' confirma, 'proposta_enviada' referencia proposta, 'negociacao' abre para ajuste, 'fechado' faz onboarding, 'perdido' encerra com respeito.",
      "",
      "CONTEXTO DO NEGÓCIO:",
      `Nicho: ${profile.niche || "-"}`,
      `Público-alvo: ${profile.audience || "-"}`,
      `Produto/serviço: ${profile.product || "-"}`,
      `Cliente ideal: ${profile.ideal_customer || "-"}`,
      `Tom: ${profile.tone || "-"}`,
      `Linguagem: ${profile.language || "-"}`,
      `Foco comercial: ${profile.focus || "-"}`,
      `Abordagem sugerida: ${profile.approach || "-"}`,
      `Diferenciais: ${profile.differentials || "-"}`,
      `Dores: ${(profile.pains || []).join("; ") || "-"}`,
      `Benefícios: ${(profile.benefits || []).join("; ") || "-"}`,
      `Gatilhos: ${(profile.triggers || []).join("; ") || "-"}`,
    ].join("\n");

    const raw = await callGroq(prompt, SYSTEM_ANALYST);
    const parsed = safeJsonParse<{ items?: Array<{ stage?: string; titulo?: string; corpo?: string }> }>(raw);
    const items = (parsed?.items ?? []).filter(
      (i) => i && typeof i.stage === "string" && STAGES.includes(i.stage as Stage) && typeof i.corpo === "string" && i.corpo.trim().length > 0,
    );
    if (items.length === 0) throw new Error("A IA não retornou mensagens válidas. Tente novamente.");

    // Atualiza (ou cria) o template PADRÃO da organização (owner_id IS NULL)
    // por stage. Overrides individuais de members (owner_id = auth.uid()) NÃO
    // são tocados — se o usuário quiser adotar o novo padrão, basta clicar
    // em "Restaurar padrão" em /meus-templates.
    // Também preserva cad_messages já renderizadas em cadências em andamento.
    let updated = 0;
    for (const it of items) {
      const stage = it.stage as Stage;
      const titulo = (it.titulo ?? `Mensagem — ${stage}`).slice(0, 200);
      const corpo = String(it.corpo).slice(0, 4000);

      const { data: existing } = await supabase
        .from("cad_templates")
        .select("id")
        .eq("organization_id", orgId)
        .is("owner_id", null)
        .eq("stage", stage)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("cad_templates")
          .update({ titulo, corpo, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (!error) updated += 1;
      } else {
        const { error } = await supabase
          .from("cad_templates")
          .insert({ organization_id: orgId, owner_id: null, stage, titulo, corpo });
        if (!error) updated += 1;
      }
    }

    return { updated, total_stages: STAGES.length };
  });