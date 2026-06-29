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
  type Q = {
    gte: (c: string, v: string) => Q;
    lte: (c: string, v: string) => Q;
    in: (c: string, v: string[]) => Q;
    is: (c: string, v: unknown) => Q;
  };
  const between = (q: unknown, col: string): Q => {
    let out = (q as Q).gte(col, ini);
    if (fim) out = out.lte(col, fim);
    return out;
  };
  const [cad, tp, cnt, tpRows, novosProspects, novosCadOnly] = await Promise.all([
    between(sb.from("cad_messages" as never).select("id", { count: "exact", head: true }), "created_at"),
    between(sb.from("prospect_touchpoints" as never).select("id", { count: "exact", head: true }), "enviado_em").in(
      "tipo",
      OUTBOUND_TYPES,
    ),
    between(sb.from("op_contracts" as never).select("monthly_value, contract_value, signed_at"), "signed_at"),
    between(sb.from("prospect_touchpoints" as never).select("prospect_id"), "enviado_em").in("tipo", OUTBOUND_TYPES),
    between(sb.from("prospects" as never).select("id", { count: "exact", head: true }), "created_at"),
    // Leads que entraram direto pela cadência/disparo e ainda não viraram prospect.
    // `prospect_id` é UNIQUE quando não nulo → evita contagem dupla com prospects.
    between(sb.from("cad_leads" as never).select("id", { count: "exact", head: true }), "created_at").is(
      "prospect_id",
      null,
    ),
  ]);
  type Contract = { monthly_value?: number | null; contract_value?: number | null };
  const contratos = ((cnt as unknown as { data: Contract[] | null }).data ?? []) as Contract[];
  const receita = contratos.reduce(
    (acc, c) => acc + Number(c.monthly_value ?? c.contract_value ?? 0),
    0,
  );
  const tpData = ((tpRows as unknown as { data: Array<{ prospect_id: string | null }> | null }).data ?? []);
  const empresasTrabalhadas = new Set(tpData.map((r) => r.prospect_id).filter(Boolean)).size;
  const novosProspectsCount = (novosProspects as unknown as { count: number | null }).count ?? 0;
  const novosCadCount = (novosCadOnly as unknown as { count: number | null }).count ?? 0;
  return {
    receita,
    disparos: (cad as unknown as { count: number | null }).count ?? 0,
    contatos: (tp as unknown as { count: number | null }).count ?? 0,
    contratos: contratos.length,
    empresasTrabalhadas,
    // União: cadastros + leads vindos da cadência sem prospect ainda.
    novosContatos: novosProspectsCount + novosCadCount,
    videos: 0,
    parcerias: 0,
  };
}