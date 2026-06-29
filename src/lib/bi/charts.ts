import { supabase as sb } from "@/integrations/supabase/client";
import { localTimestamp, localDateKey } from "./tz";

/**
 * Helpers de séries temporais para os gráficos do /bi.
 * Lê das tabelas reais já usadas pelo app (sem mocks, sem RPC).
 * Cada função degrada para [] sem quebrar a tela quando faltar dado.
 */

function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function dayKey(d: Date) {
  return localDateKey(d); // YYYY-MM-DD em fuso local
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shortDay(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function shortMonth(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "short" });
}

/** N dias inclusive até hoje, com label pt-BR. */
function lastNDays(n: number) {
  const today = startOfDay(new Date());
  const out: { date: Date; key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    out.push({ date: d, key: dayKey(d), label: shortDay(d) });
  }
  return out;
}

function lastNMonths(n: number) {
  const today = new Date();
  const out: { date: Date; key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push({ date: d, key: monthKey(d), label: shortMonth(d) });
  }
  return out;
}

async function safeSelect<T = Record<string, unknown>>(
  table: string,
  columns: string,
  filter?: (q: ReturnType<typeof sb.from>) => unknown,
): Promise<T[]> {
  try {
    let q = sb.from(table as never).select(columns);
    if (filter) q = filter(q as unknown as ReturnType<typeof sb.from>) as typeof q;
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []) as unknown as T[];
  } catch {
    return [];
  }
}

// ============================================================
// COMERCIAL — Novos leads vs Touchpoints (14 dias)
// ============================================================
export interface DailyComercialPoint {
  dia: string;
  novosLeads: number;
  touchpoints: number;
}

export async function fetchComercialDaily(days = 14): Promise<DailyComercialPoint[]> {
  const buckets = lastNDays(days);
  const ini = localTimestamp(buckets[0].date);
  const [tps, leads] = await Promise.all([
    safeSelect<{ enviado_em: string | null }>(
      "prospect_touchpoints",
      "enviado_em",
      (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("enviado_em", ini),
    ),
    safeSelect<{ created_at: string | null }>(
      "prospects",
      "created_at",
      (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("created_at", ini),
    ),
  ]);
  const tpMap = new Map<string, number>();
  for (const r of tps) {
    if (!r.enviado_em) continue;
    const k = dayKey(new Date(r.enviado_em));
    tpMap.set(k, (tpMap.get(k) ?? 0) + 1);
  }
  const ldMap = new Map<string, number>();
  for (const r of leads) {
    if (!r.created_at) continue;
    const k = dayKey(new Date(r.created_at));
    ldMap.set(k, (ldMap.get(k) ?? 0) + 1);
  }
  return buckets.map((b) => ({
    dia: b.label,
    novosLeads: ldMap.get(b.key) ?? 0,
    touchpoints: tpMap.get(b.key) ?? 0,
  }));
}

// ============================================================
// FINANCEIRO — Receita assinada por mês (6 meses)
// ============================================================
export interface MonthlyRevenuePoint {
  mes: string;
  receita: number;
  contratos: number;
}

type ContractRow = {
  monthly_value?: number | null;
  contract_value?: number | null;
  value?: number | null;
  signed_at?: string | null;
};

export async function fetchFinanceiroMonthly(months = 6): Promise<MonthlyRevenuePoint[]> {
  const buckets = lastNMonths(months);
  const ini = localTimestamp(buckets[0].date);

  let rows = await safeSelect<ContractRow>(
    "contracts",
    "monthly_value, contract_value, value, signed_at",
    (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("signed_at", ini),
  );
  if (rows.length === 0) {
    rows = await safeSelect<ContractRow>(
      "op_contracts",
      "monthly_value, contract_value, signed_at",
      (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("signed_at", ini),
    );
  }
  // Lifecycle clients (Ficha 360°) também alimentam Receita mensal.
  const { fetchClientsAsContracts } = await import("./clients-source");
  const clientRows = (await fetchClientsAsContracts()) as unknown as ContractRow[];
  rows = [
    ...rows,
    ...clientRows.filter((r) => r.signed_at && String(r.signed_at) >= ini),
  ];

  const recMap = new Map<string, { receita: number; contratos: number }>();
  for (const r of rows) {
    if (!r.signed_at) continue;
    const k = monthKey(new Date(r.signed_at));
    const val = Number(r.contract_value ?? r.value ?? r.monthly_value ?? 0);
    const acc = recMap.get(k) ?? { receita: 0, contratos: 0 };
    acc.receita += val;
    acc.contratos += 1;
    recMap.set(k, acc);
  }
  return buckets.map((b) => ({
    mes: b.label,
    receita: Math.round(recMap.get(b.key)?.receita ?? 0),
    contratos: recMap.get(b.key)?.contratos ?? 0,
  }));
}

// ============================================================
// MARKETING — Disparos por dia (14 dias) + canais
// ============================================================
export interface DailyDispatchPoint {
  dia: string;
  disparos: number;
}

export async function fetchMarketingDispatches(days = 14): Promise<DailyDispatchPoint[]> {
  const buckets = lastNDays(days);
  const ini = localTimestamp(buckets[0].date);
  const rows = await safeSelect<{ created_at: string | null }>(
    "cad_messages",
    "created_at",
    (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("created_at", ini),
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.created_at) continue;
    const k = dayKey(new Date(r.created_at));
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return buckets.map((b) => ({ dia: b.label, disparos: map.get(b.key) ?? 0 }));
}

export interface ChannelMixPoint {
  canal: string;
  total: number;
}

/** Mix de canais nos últimos N dias (lê tipo de prospect_touchpoints). */
export async function fetchMarketingChannelMix(days = 30): Promise<ChannelMixPoint[]> {
  const ini = startOfDay(new Date());
  ini.setDate(ini.getDate() - days);
  const rows = await safeSelect<{ tipo: string | null }>(
    "prospect_touchpoints",
    "tipo",
    (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("enviado_em", localTimestamp(ini)),
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = (r.tipo ?? "outro").toString();
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([canal, total]) => ({ canal, total }))
    .sort((a, b) => b.total - a.total);
}

// ============================================================
// OPERAÇÕES — Distribuição de status de contratos + funil real
// ============================================================
export interface StatusBucketPoint {
  status: string;
  total: number;
}

export async function fetchOperacoesStatusMix(): Promise<StatusBucketPoint[]> {
  let rows = await safeSelect<{ status: string | null }>("contracts", "status");
  if (rows.length === 0) rows = await safeSelect<{ status: string | null }>("op_contracts", "status");
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = (r.status ?? "sem status").toString().toLowerCase();
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([status, total]) => ({ status, total }))
    .sort((a, b) => b.total - a.total);
}

export interface DailyOpsPoint {
  dia: string;
  novosContratos: number;
  touchpoints: number;
}

export async function fetchOperacoesDaily(days = 14): Promise<DailyOpsPoint[]> {
  const buckets = lastNDays(days);
  const ini = localTimestamp(buckets[0].date);
  let contratos = await safeSelect<{ signed_at: string | null }>(
    "contracts",
    "signed_at",
    (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("signed_at", ini),
  );
  if (contratos.length === 0) {
    contratos = await safeSelect<{ signed_at: string | null }>(
      "op_contracts",
      "signed_at",
      (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("signed_at", ini),
    );
  }
  const tps = await safeSelect<{ enviado_em: string | null }>(
    "prospect_touchpoints",
    "enviado_em",
    (q) => (q as unknown as { gte: (c: string, v: string) => unknown }).gte("enviado_em", ini),
  );

  const cMap = new Map<string, number>();
  for (const r of contratos) {
    if (!r.signed_at) continue;
    const k = dayKey(new Date(r.signed_at));
    cMap.set(k, (cMap.get(k) ?? 0) + 1);
  }
  const tMap = new Map<string, number>();
  for (const r of tps) {
    if (!r.enviado_em) continue;
    const k = dayKey(new Date(r.enviado_em));
    tMap.set(k, (tMap.get(k) ?? 0) + 1);
  }
  return buckets.map((b) => ({
    dia: b.label,
    novosContratos: cMap.get(b.key) ?? 0,
    touchpoints: tMap.get(b.key) ?? 0,
  }));
}