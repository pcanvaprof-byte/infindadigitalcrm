import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/app-auth-middleware";
import {
  buildImplantacaoPlan,
  buildMensalidadePlan,
  validateBillingPlan,
  type BillingItem,
  type PlanDraftItem,
} from "./api";

// ---------- Schema (mesmo shape do diálogo "Gerar plano rápido") ----------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(s + "T12:00:00").getTime()), {
    message: "Data inválida",
  });

const uuid = z.string().uuid("clientId inválido");

const singleImplantacao = z.object({
  mode: z.literal("single-implantacao"),
  clientId: uuid,
  descricao: z.string().trim().min(1, "Descrição vazia").max(120),
  valor: z.number().positive("Valor deve ser maior que zero"),
  parcelas: z.number().int().min(1).max(36),
  dataInicial: isoDate,
  intervaloDias: z.number().int().positive().max(365),
});

const singleMensalidade = z.object({
  mode: z.literal("single-mensalidade"),
  clientId: uuid,
  descricao: z.string().trim().min(1, "Descrição vazia").max(120),
  valor: z.number().positive("Valor mensal deve ser maior que zero"),
  parcelas: z.number().int().min(1).max(60),
  dataInicial: isoDate,
  bonificar: z.number().int().min(0).default(0),
});

const presetCombinado = z.object({
  mode: z.literal("preset-combinado"),
  clientId: uuid,
  dataInicial: isoDate,
  site: z.object({
    descricao: z.string().trim().min(1).max(120),
    valor: z.number().positive(),
    parcelas: z.number().int().min(1).max(12),
    intervaloDias: z.number().int().positive().max(365),
  }),
  mentoria: z.object({
    descricao: z.string().trim().min(1).max(120),
    valor: z.number().positive(),
    meses: z.number().int().min(1).max(36),
    bonificar: z.number().int().min(0).default(0),
  }),
});

const GeneratePlanInput = z.discriminatedUnion("mode", [
  singleImplantacao,
  singleMensalidade,
  presetCombinado,
]);

export type GeneratePlanInput = z.infer<typeof GeneratePlanInput>;

// ---------- Inconsistências de negócio (mesmas do diálogo) ----------

function checkInconsistencies(input: GeneratePlanInput): string[] {
  const ws: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const checkDate = (label: string, d: string) => {
    if (d < today) ws.push(`${label}: data inicial está no passado (${d}).`);
  };
  const checkIntervalo = (label: string, dias: number) => {
    if (dias > 90) ws.push(`${label}: intervalo de ${dias}d parece muito longo (padrão 15d).`);
    else if (dias % 15 !== 0) ws.push(`${label}: intervalo de ${dias}d não é múltiplo de 15d.`);
  };
  const checkParcelasSug = (label: string, n: number, max: number) => {
    if (n > max) ws.push(`${label}: ${n} parcelas excede o máximo sugerido (${max}).`);
  };
  const checkBonif = (label: string, bonif: number, meses: number) => {
    if (bonif >= meses)
      ws.push(`${label}: bonificação (${bonif}) ≥ meses (${meses}) — nenhuma parcela seria cobrada.`);
  };

  if (input.mode === "single-implantacao") {
    checkDate("Implantação", input.dataInicial);
    checkIntervalo("Implantação", input.intervaloDias);
    checkParcelasSug("Implantação", input.parcelas, 12);
  } else if (input.mode === "single-mensalidade") {
    checkDate("Mensalidade", input.dataInicial);
    checkParcelasSug("Mensalidade", input.parcelas, 24);
    checkBonif("Mensalidade", input.bonificar ?? 0, input.parcelas);
  } else {
    checkDate("Site + Mentoria", input.dataInicial);
    checkIntervalo("Site", input.site.intervaloDias);
    checkParcelasSug("Site", input.site.parcelas, 12);
    checkParcelasSug("Mentoria", input.mentoria.meses, 24);
    checkBonif("Mentoria", input.mentoria.bonificar ?? 0, input.mentoria.meses);
  }
  return ws;
}

// ---------- Builder + expectedTotal a partir do input ----------

function buildDraftsFromInput(input: GeneratePlanInput): {
  drafts: PlanDraftItem[];
  expectedTotal: number;
} {
  if (input.mode === "single-implantacao") {
    return {
      drafts: buildImplantacaoPlan({
        clientId: input.clientId,
        valorTotal: input.valor,
        parcelas: input.parcelas,
        dataInicial: input.dataInicial,
        intervaloDias: input.intervaloDias,
        descricaoBase: input.descricao,
      }),
      expectedTotal: input.valor,
    };
  }
  if (input.mode === "single-mensalidade") {
    const bonif = input.bonificar ?? 0;
    return {
      drafts: buildMensalidadePlan({
        clientId: input.clientId,
        valorMensal: input.valor,
        meses: input.parcelas,
        dataInicial: input.dataInicial,
        descricaoBase: input.descricao,
        bonificarPrimeirosMeses: bonif,
      }),
      expectedTotal: Math.max(0, input.parcelas - bonif) * input.valor,
    };
  }
  const site = buildImplantacaoPlan({
    clientId: input.clientId,
    valorTotal: input.site.valor,
    parcelas: input.site.parcelas,
    dataInicial: input.dataInicial,
    intervaloDias: input.site.intervaloDias,
    descricaoBase: input.site.descricao,
  });
  const bonif = input.mentoria.bonificar ?? 0;
  const ment = buildMensalidadePlan({
    clientId: input.clientId,
    valorMensal: input.mentoria.valor,
    meses: input.mentoria.meses,
    dataInicial: input.dataInicial,
    descricaoBase: input.mentoria.descricao,
    bonificarPrimeirosMeses: bonif,
  });
  return {
    drafts: [...site, ...ment],
    expectedTotal:
      input.site.valor +
      Math.max(0, input.mentoria.meses - bonif) * input.mentoria.valor,
  };
}

// ---------- Server fn ----------

export const generateBillingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GeneratePlanInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Confirma que o cliente existe e é acessível ao usuário (RLS).
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientErr) throw new Error(clientErr.message);
    if (!client) throw new Error("Cliente não encontrado ou sem permissão.");

    // 2. Constrói drafts + expectedTotal.
    const { drafts, expectedTotal } = buildDraftsFromInput(data);

    // 3. Busca parcelas existentes para detectar duplicidades.
    const { data: existing, error: existingErr } = await supabase
      .from("client_billing_items")
      .select("*")
      .eq("client_id", data.clientId);
    if (existingErr) throw new Error(existingErr.message);

    // 4. Roda as validações duras + inconsistências (aqui viram erros).
    const errors = [
      ...validateBillingPlan(drafts, (existing ?? []) as BillingItem[], { expectedTotal }),
      ...checkInconsistencies(data),
    ];
    if (errors.length) {
      throw new Error(`Plano inválido: ${errors.join(" | ")}`);
    }

    // 5. Insere via RLS do usuário.
    const { error: insertErr } = await supabase
      .from("client_billing_items")
      .insert(drafts);
    if (insertErr) throw new Error(insertErr.message);

    return { created: drafts.length };
  });
