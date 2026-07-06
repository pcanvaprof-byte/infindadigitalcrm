import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type BillingStatus = "pendente" | "pago" | "atrasado" | "bonificado" | "cancelado";
export type BillingTipo = "implantacao" | "mensalidade" | "avulso";

export interface BillingItem {
  id: string;
  client_id: string;
  organization_id: string;
  descricao: string;
  tipo: BillingTipo;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  status: BillingStatus;
  pago_em: string | null;
  metodo: string | null;
  observacao: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export const billingKeys = {
  byClient: (clientId: string) => ["billing", clientId] as const,
  presets: ["billing", "presets"] as const,
};

// ---------------- Presets ----------------

export interface BillingPreset {
  id: string;
  nome: string;
  site_descricao: string;
  site_valor: number;
  site_parcelas: number;
  site_intervalo_dias: number;
  mentoria_descricao: string;
  mentoria_valor: number;
  mentoria_meses: number;
  mentoria_bonif: number;
  created_at: string;
  updated_at: string;
}

export type BillingPresetInput = Omit<BillingPreset, "id" | "created_at" | "updated_at">;

export async function listBillingPresets(): Promise<BillingPreset[]> {
  const { data, error } = await sb
    .from("billing_presets")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BillingPreset[];
}

export async function createBillingPreset(input: BillingPresetInput): Promise<BillingPreset> {
  const { data, error } = await sb.from("billing_presets").insert(input).select("*").single();
  if (error) throw error;
  return data as BillingPreset;
}

export async function updateBillingPreset(id: string, patch: Partial<BillingPresetInput>): Promise<BillingPreset> {
  const { data, error } = await sb.from("billing_presets").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as BillingPreset;
}

export async function deleteBillingPreset(id: string): Promise<void> {
  const { error } = await sb.from("billing_presets").delete().eq("id", id);
  if (error) throw error;
}

export async function listBillingItems(clientId: string): Promise<BillingItem[]> {
  const { data, error } = await sb
    .from("client_billing_items")
    .select("*")
    .eq("client_id", clientId)
    .order("vencimento", { ascending: true })
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BillingItem[];
}

export async function createBillingItem(
  input: Omit<BillingItem, "id" | "organization_id" | "created_at" | "updated_at" | "pago_em"> & {
    pago_em?: string | null;
  },
): Promise<BillingItem> {
  const { data, error } = await sb
    .from("client_billing_items")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as BillingItem;
}

export async function createManyBillingItems(items: Array<Omit<BillingItem, "id" | "organization_id" | "created_at" | "updated_at" | "pago_em"> & { pago_em?: string | null }>): Promise<void> {
  if (items.length === 0) return;
  const { error } = await sb.from("client_billing_items").insert(items);
  if (error) throw error;
}

export async function updateBillingItem(id: string, patch: Partial<BillingItem>): Promise<void> {
  const { error } = await sb.from("client_billing_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBillingItem(id: string): Promise<void> {
  const { error } = await sb.from("client_billing_items").delete().eq("id", id);
  if (error) throw error;
}

export async function markAsPaid(id: string, metodo?: string): Promise<void> {
  const { error } = await sb
    .from("client_billing_items")
    .update({ status: "pago", pago_em: new Date().toISOString(), metodo: metodo ?? null })
    .eq("id", id);
  if (error) throw error;
}

// ------ Helpers ------

export function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(baseISO + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsISO(baseISO: string, months: number): string {
  const d = new Date(baseISO + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Extrai o "nome base" de uma parcela gerada pelos planos
 * (ex.: "Mentoria — Mês 3 (bonificado)" → "Mentoria",
 *  "Site — 2/3" → "Site"). Usa " — " (em dash) como separador.
 */
export function extractPlanBase(descricao: string): string {
  const sep = " — ";
  const idx = descricao.indexOf(sep);
  return (idx > 0 ? descricao.slice(0, idx) : descricao).trim();
}

/** Gera N parcelas de implantação a partir de uma data base (dias entre parcelas). */
export function buildImplantacaoPlan(args: {
  clientId: string;
  valorTotal: number;
  parcelas: number;
  dataInicial: string; // YYYY-MM-DD
  intervaloDias: number;
  descricaoBase: string;
}) {
  const each = Math.round((args.valorTotal / args.parcelas) * 100) / 100;
  const items = [] as Array<Omit<BillingItem, "id" | "organization_id" | "created_at" | "updated_at" | "pago_em">>;
  for (let i = 0; i < args.parcelas; i++) {
    // Ajuste de arredondamento na última parcela
    const valor = i === args.parcelas - 1 ? Math.round((args.valorTotal - each * (args.parcelas - 1)) * 100) / 100 : each;
    items.push({
      client_id: args.clientId,
      descricao: `${args.descricaoBase} — ${i + 1}/${args.parcelas}`,
      tipo: "implantacao",
      valor,
      vencimento: addDaysISO(args.dataInicial, i * args.intervaloDias),
      status: "pendente",
      metodo: null,
      observacao: null,
      ordem: i,
    });
  }
  return items;
}

/** Gera N mensalidades mensais a partir da data inicial. */
export function buildMensalidadePlan(args: {
  clientId: string;
  valorMensal: number;
  meses: number;
  dataInicial: string;
  descricaoBase: string;
  bonificarPrimeirosMeses?: number;
}) {
  const items = [] as Array<Omit<BillingItem, "id" | "organization_id" | "created_at" | "updated_at" | "pago_em">>;
  const bonif = args.bonificarPrimeirosMeses ?? 0;
  for (let i = 0; i < args.meses; i++) {
    const isBonif = i < bonif;
    items.push({
      client_id: args.clientId,
      descricao: `${args.descricaoBase} — Mês ${i + 1}${isBonif ? " (bonificado)" : ""}`,
      tipo: "mensalidade",
      valor: isBonif ? 0 : args.valorMensal,
      vencimento: addMonthsISO(args.dataInicial, i),
      status: isBonif ? "bonificado" : "pendente",
      metodo: null,
      observacao: isBonif ? "Bonificação promocional" : null,
      ordem: 100 + i,
    });
  }
  return items;
}

export function summarize(items: BillingItem[]) {
  const today = new Date().toISOString().slice(0, 10);
  let total = 0, recebido = 0, aReceber = 0, atrasado = 0, bonificado = 0;
  for (const it of items) {
    const v = Number(it.valor);
    total += v;
    if (it.status === "pago") recebido += v;
    else if (it.status === "bonificado") bonificado += v;
    else if (it.status === "cancelado") {
      // não soma
    } else if (it.vencimento < today) atrasado += v;
    else aReceber += v;
  }
  return { total, recebido, aReceber, atrasado, bonificado };
}

// ------ Validação ------

export type PlanDraftItem = Omit<
  BillingItem,
  "id" | "organization_id" | "created_at" | "updated_at" | "pago_em"
> & { pago_em?: string | null };

/**
 * Valida uma lista de parcelas antes de salvar.
 * Retorna array de mensagens (vazio = ok).
 */
export function validateBillingPlan(
  drafts: PlanDraftItem[],
  existing: BillingItem[] = [],
  opts: { expectedTotal?: number } = {},
): string[] {
  const errors: string[] = [];
  if (drafts.length === 0) {
    errors.push("Nenhuma parcela para salvar.");
    return errors;
  }

  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  const seen = new Map<string, number>();
  const existingKeys = new Set(
    existing.map((e) => `${e.descricao.trim().toLowerCase()}|${e.vencimento}`),
  );
  const groupDates = new Map<string, string[]>();

  let somaCobravel = 0;
  let temValorPositivo = false;

  drafts.forEach((d, idx) => {
    const label = `Parcela ${idx + 1}`;
    const desc = (d.descricao || "").trim();
    if (!desc) errors.push(`${label}: descrição vazia.`);

    if (!isoRe.test(d.vencimento) || Number.isNaN(new Date(d.vencimento + "T12:00:00").getTime())) {
      errors.push(`${label}: vencimento inválido (${d.vencimento || "vazio"}).`);
    }

    const v = Number(d.valor);
    if (Number.isNaN(v)) errors.push(`${label}: valor não numérico.`);
    else if (v < 0) errors.push(`${label}: valor negativo (${v}).`);

    if (d.status === "bonificado" && v !== 0) {
      errors.push(`${label}: parcela bonificada deve ter valor 0.`);
    }

    if (d.status !== "bonificado" && d.status !== "cancelado") {
      somaCobravel += v || 0;
      if ((v || 0) > 0) temValorPositivo = true;
    }

    const key = `${desc.toLowerCase()}|${d.vencimento}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);

    if (existingKeys.has(key)) {
      errors.push(`${label}: já existe parcela "${desc}" com vencimento ${d.vencimento}.`);
    }

    const base = desc.split(" — ")[0] || desc;
    const arr = groupDates.get(base) ?? [];
    arr.push(d.vencimento);
    groupDates.set(base, arr);
  });

  for (const [k, c] of seen) {
    if (c > 1) {
      const [desc, venc] = k.split("|");
      errors.push(`Duplicidade: "${desc}" no vencimento ${venc} aparece ${c}x.`);
    }
  }

  for (const [base, dates] of groupDates) {
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] < dates[i - 1]) {
        errors.push(`"${base}": vencimentos fora de ordem (${dates[i - 1]} → ${dates[i]}).`);
        break;
      }
    }
  }

  if (!temValorPositivo) {
    errors.push("Plano sem nenhum valor cobrável (todas as parcelas são 0/bonificadas).");
  }

  if (typeof opts.expectedTotal === "number" && !Number.isNaN(opts.expectedTotal)) {
    const diff = Math.round((somaCobravel - opts.expectedTotal) * 100) / 100;
    if (Math.abs(diff) > 0.05) {
      errors.push(
        `Total incoerente: soma das parcelas (R$${somaCobravel.toFixed(2)}) difere do esperado (R$${opts.expectedTotal.toFixed(2)}).`,
      );
    }
  }

  return errors;
}