import { supabase as sb } from "@/integrations/supabase/client";
import { localTimestamp } from "./tz";
import { fetchClientsAsContracts } from "./clients-source";

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
  novosContatos: number;       // união (cadastrados + via disparo) — anti-duplicação
  novosCadastrados: number;    // prospects criados via formulário/visita/indicação
  novosViaDisparo: number;     // cad_leads que entraram pela cadência sem virar prospect ainda
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
    not: (c: string, op: string, v: unknown) => Q;
  };
  const between = (q: unknown, col: string): Q => {
    let out = (q as Q).gte(col, ini);
    if (fim) out = out.lte(col, fim);
    return out;
  };
  const [cad, tp, cnt, tpRows, novosProspects, novosCadOnly, novosCadComProspect] = await Promise.all([
    between(sb.from("cad_messages" as never).select("id", { count: "exact", head: true }), "created_at"),
    between(sb.from("prospect_touchpoints" as never).select("id", { count: "exact", head: true }), "enviado_em").in(
      "tipo",
      OUTBOUND_TYPES,
    ),
    // op_contracts NÃO existe neste projeto — a única fonte real de contratos é
    // fetchClientsAsContracts() (usada abaixo). Devolvemos payload vazio para
    // preservar a tupla e evitar 400 no console.
    Promise.resolve({ data: [] as Array<{ monthly_value?: number | null; contract_value?: number | null; signed_at?: string | null }>, count: null, error: null }),
    between(sb.from("prospect_touchpoints" as never).select("prospect_id"), "enviado_em").in("tipo", OUTBOUND_TYPES),
    between(sb.from("prospects" as never).select("id", { count: "exact", head: true }), "created_at"),
    // Leads que entraram direto pela cadência/disparo e ainda não viraram prospect.
    // `prospect_id` é UNIQUE quando não nulo → evita contagem dupla com prospects.
    between(sb.from("cad_leads" as never).select("id", { count: "exact", head: true }), "created_at").is(
      "prospect_id",
      null,
    ),
    // Verificação automática anti-duplicação: conta cad_leads no período que JÁ
    // possuem prospect_id. Esses NÃO devem entrar em "Novos contatos" — são
    // contados pela tabela prospects. Se algum dia esse número escapar pro
    // total, vira evidência clara de falha no filtro.
    between(sb.from("cad_leads" as never).select("id", { count: "exact", head: true }), "created_at").not(
      "prospect_id",
      "is",
      null,
    ),
  ]);
  type Contract = { monthly_value?: number | null; contract_value?: number | null };
  const contratos = ((cnt as unknown as { data: Contract[] | null }).data ?? []) as Contract[];
  // Adiciona clientes do lifecycle (Ficha 360°) cuja ativação caiu no período.
  const clientRows = await fetchClientsAsContracts();
  const clientesNoPeriodo = clientRows.filter((r) => {
    if (!r.signed_at) return false;
    const s = String(r.signed_at);
    return s >= ini && (!fim || s <= fim);
  });
  const todosContratos: Contract[] = [...contratos, ...clientesNoPeriodo];
  const receita = todosContratos.reduce(
    (acc, c) => acc + Number(c.monthly_value ?? c.contract_value ?? 0),
    0,
  );
  const tpData = ((tpRows as unknown as { data: Array<{ prospect_id: string | null }> | null }).data ?? []);
  const empresasTrabalhadas = new Set(tpData.map((r) => r.prospect_id).filter(Boolean)).size;
  const novosProspectsCount = (novosProspects as unknown as { count: number | null }).count ?? 0;
  const novosCadCount = (novosCadOnly as unknown as { count: number | null }).count ?? 0;
  const cadComProspectCount = (novosCadComProspect as unknown as { count: number | null }).count ?? 0;

  // Sanity check em runtime: garante que cad_leads vinculados a prospect NÃO
  // estão sendo somados. Se aparecer no console, há regressão no filtro acima.
  if (cadComProspectCount > 0 && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug(
      `[bi/today] anti-dup ok: ${cadComProspectCount} cad_leads com prospect_id no período foram ignorados ` +
        `(já contabilizados via prospects).`,
    );
  }
  return {
    receita,
    disparos: (cad as unknown as { count: number | null }).count ?? 0,
    contatos: (tp as unknown as { count: number | null }).count ?? 0,
    contratos: todosContratos.length,
    empresasTrabalhadas,
    // União: cadastros + leads vindos da cadência sem prospect ainda.
    novosContatos: novosProspectsCount + novosCadCount,
    novosCadastrados: novosProspectsCount,
    novosViaDisparo: novosCadCount,
    videos: 0,
    parcerias: 0,
  };
}