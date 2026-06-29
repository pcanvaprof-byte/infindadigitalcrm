import { supabase as sb } from "@/integrations/supabase/client";
import { localTimestamp } from "./tz";

export interface TodayMetrics {
  visitas: number;    // touchpoints tipo=reuniao hoje
  contatos: number;   // touchpoints outbound hoje (whatsapp/ligacao/email/reuniao)
  disparos: number;   // mensagens cad_messages hoje
}

export interface WeekMetrics {
  receita: number;        // receita realizada na semana corrente (seg→hoje)
  disparos: number;       // mensagens enviadas na semana
  contatos: number;       // touchpoints outbound na semana
  contratos: number;      // contratos assinados na semana
  empresasTrabalhadas: number; // distinct prospect_id tocados na semana
  novosContatos: number;  // prospects criados na semana
  videos: number;         // sem fonte ainda → fallback 0
  parcerias: number;      // sem fonte ainda → fallback 0
}

function startOfDayIso(d = new Date()): string {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return localTimestamp(x);
}
function endOfDayIso(d = new Date()): string {
  const x = new Date(d); x.setHours(23, 59, 59, 999);
  return localTimestamp(x);
}
function startOfWeekIso(d = new Date()): string {
  // Semana operacional: segunda-feira 00:00
  const x = new Date(d);
  const dow = x.getDay(); // 0=dom..6=sáb
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return localTimestamp(x);
}

const OUTBOUND_TYPES = ["whatsapp", "ligacao", "email", "reuniao"];

export async function fetchTodayMetrics(): Promise<TodayMetrics> {
  const ini = startOfDayIso();
  const fim = endOfDayIso();
  const [tp, cad] = await Promise.all([
    sb.from("prospect_touchpoints" as never)
      .select("tipo", { count: "exact", head: false })
      .gte("enviado_em", ini).lte("enviado_em", fim)
      .in("tipo", OUTBOUND_TYPES),
    sb.from("cad_messages" as never)
      .select("id", { count: "exact", head: true })
      .gte("created_at", ini).lte("created_at", fim),
  ]);
  const rows = ((tp.data ?? []) as Array<{ tipo: string }>);
  const visitas = rows.filter((r) => r.tipo === "reuniao").length;
  const contatos = rows.length;
  const disparos = (cad as { count: number | null }).count ?? 0;
  return { visitas, contatos, disparos };
}

export async function fetchWeekMetrics(): Promise<WeekMetrics> {
  const ini = startOfWeekIso();
  return fetchRangeMetricsRaw(ini, undefined);
}

/** Métricas em um intervalo arbitrário (usado pelo filtro global do BI). */
export async function fetchRangeMetrics(from: Date, to: Date): Promise<WeekMetrics> {
  const ini = localTimestamp(new Date(new Date(from).setHours(0, 0, 0, 0)));
  const fim = localTimestamp(new Date(new Date(to).setHours(23, 59, 59, 999)));
  return fetchRangeMetricsRaw(ini, fim);
}

async function fetchRangeMetricsRaw(ini: string, fim: string | undefined): Promise<WeekMetrics> {
  const between = <T extends { gte: (c: string, v: string) => unknown }>(
    q: T,
    col: string,
  ): T => {
    let out = q.gte(col, ini) as T;
    if (fim) out = (out as unknown as { lte: (c: string, v: string) => T }).lte(col, fim);
    return out;
  };
  const [cad, tp, cnt, tpRows, novos] = await Promise.all([
    between(sb.from("cad_messages" as never).select("id", { count: "exact", head: true }) as never, "created_at"),
    between(
      sb.from("prospect_touchpoints" as never).select("id", { count: "exact", head: true }) as never,
      "enviado_em",
    ).in("tipo", OUTBOUND_TYPES),
    between(
      sb.from("op_contracts" as never).select("monthly_value, contract_value, signed_at") as never,
      "signed_at",
    ),
    between(
      sb.from("prospect_touchpoints" as never).select("prospect_id") as never,
      "enviado_em",
    ).in("tipo", OUTBOUND_TYPES),
    between(sb.from("prospects" as never).select("id", { count: "exact", head: true }) as never, "created_at"),
  ]);
  type Contract = { monthly_value?: number | null; contract_value?: number | null };
  const contratos = ((cnt as { data: Contract[] | null }).data ?? []) as Contract[];
  const receita = contratos.reduce(
    (acc, c) => acc + Number(c.monthly_value ?? c.contract_value ?? 0),
    0,
  );
  const tpData = ((tpRows as { data: Array<{ prospect_id: string | null }> | null }).data ?? []);
  const empresasTrabalhadas = new Set(tpData.map((r) => r.prospect_id).filter(Boolean)).size;
  return {
    receita,
    disparos: (cad as { count: number | null }).count ?? 0,
    contatos: (tp as { count: number | null }).count ?? 0,
    contratos: contratos.length,
    empresasTrabalhadas,
    novosContatos: (novos as { count: number | null }).count ?? 0,
    videos: 0,
    parcerias: 0,
  };
}