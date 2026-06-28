import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type KpiTrends = {
  /** Série diária dos últimos 7 dias (oldest -> newest). length === 7. */
  contatos7d: number[];
  respostas7d: number[];
  ativos7d: number[];
  /** Totais da semana anterior (D-14 .. D-7) para delta WoW. */
  prevWeek: { contatos: number; respostas: number; ativos: number };
  /** Totais da semana atual (D-7 .. agora) para delta WoW. */
  thisWeek: { contatos: number; respostas: number; ativos: number };
};

const EMPTY: KpiTrends = {
  contatos7d: [0, 0, 0, 0, 0, 0, 0],
  respostas7d: [0, 0, 0, 0, 0, 0, 0],
  ativos7d: [0, 0, 0, 0, 0, 0, 0],
  prevWeek: { contatos: 0, respostas: 0, ativos: 0 },
  thisWeek: { contatos: 0, respostas: 0, ativos: 0 },
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Índice 0..13 contado a partir de D-13 (oldest) até hoje (newest). -1 se fora. */
function dayIndex(ts: string | null | undefined, start: Date): number {
  if (!ts) return -1;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return -1;
  const diff = Math.floor((t - start.getTime()) / 86400000);
  if (diff < 0 || diff > 13) return -1;
  return diff;
}

async function safeSelect<T>(
  table: string,
  columns: string,
  sinceIso: string,
  dateCol: string,
): Promise<T[]> {
  try {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .gte(dateCol, sinceIso)
      .limit(10000);
    if (error) {
      console.warn(`[trends] ${table} ignorado:`, error.message);
      return [];
    }
    return (data ?? []) as T[];
  } catch (e) {
    console.warn(`[trends] ${table} falhou:`, e);
    return [];
  }
}

export async function fetchKpiTrends(): Promise<KpiTrends> {
  const now = new Date();
  const today = startOfDay(now);
  const start14 = new Date(today.getTime() - 13 * 86400000);
  const sinceIso = start14.toISOString();

  const [touchpoints, cadMessages, clients] = await Promise.all([
    safeSelect<{ tipo?: string; resultado?: string; enviado_em?: string }>(
      "prospect_touchpoints",
      "tipo,resultado,enviado_em",
      sinceIso,
      "enviado_em",
    ),
    safeSelect<{ direction?: string; created_at?: string }>(
      "cad_messages",
      "direction,created_at",
      sinceIso,
      "created_at",
    ),
    safeSelect<{ pipeline_stage?: string; updated_at?: string }>(
      "clients",
      "pipeline_stage,updated_at",
      sinceIso,
      "updated_at",
    ),
  ]);

  const contatosBuckets = new Array(14).fill(0) as number[];
  const respostasBuckets = new Array(14).fill(0) as number[];
  const ativosBuckets = new Array(14).fill(0) as number[];

  for (const tp of touchpoints) {
    const idx = dayIndex(tp.enviado_em, start14);
    if (idx < 0) continue;
    const r = String(tp.resultado ?? "");
    if (r === "enviado") contatosBuckets[idx]++;
    else if (r === "respondido" || r === "interessado" || r === "sem_interesse") {
      respostasBuckets[idx]++;
    }
  }
  for (const msg of cadMessages) {
    const idx = dayIndex(msg.created_at, start14);
    if (idx < 0) continue;
    const dir = String(msg.direction ?? "");
    if (dir === "outbound" || dir === "out") contatosBuckets[idx]++;
    else if (dir === "inbound" || dir === "in") respostasBuckets[idx]++;
  }
  for (const c of clients) {
    const idx = dayIndex(c.updated_at, start14);
    if (idx < 0) continue;
    const stage = String(c.pipeline_stage ?? "").toLowerCase();
    if (stage === "ativo" || stage === "active") ativosBuckets[idx]++;
  }

  const prevWeek = {
    contatos: contatosBuckets.slice(0, 7).reduce((a, b) => a + b, 0),
    respostas: respostasBuckets.slice(0, 7).reduce((a, b) => a + b, 0),
    ativos: ativosBuckets.slice(0, 7).reduce((a, b) => a + b, 0),
  };
  const thisWeek = {
    contatos: contatosBuckets.slice(7).reduce((a, b) => a + b, 0),
    respostas: respostasBuckets.slice(7).reduce((a, b) => a + b, 0),
    ativos: ativosBuckets.slice(7).reduce((a, b) => a + b, 0),
  };

  return {
    contatos7d: contatosBuckets.slice(7),
    respostas7d: respostasBuckets.slice(7),
    ativos7d: ativosBuckets.slice(7),
    prevWeek,
    thisWeek,
  };
}

export function wowDelta(current: number, previous: number): { pct: number; up: boolean } | undefined {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return { pct: 100, up: current > 0 };
  const pct = ((current - previous) / previous) * 100;
  return { pct, up: pct >= 0 };
}

export const EMPTY_TRENDS = EMPTY;