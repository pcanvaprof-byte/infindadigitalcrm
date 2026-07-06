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
};

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

function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(baseISO + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(baseISO: string, months: number): string {
  const d = new Date(baseISO + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
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