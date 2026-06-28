import { supabase as sb } from "@/integrations/supabase/client";

export interface TodayMetrics {
  visitas: number;    // touchpoints tipo=reuniao hoje
  contatos: number;   // touchpoints outbound hoje (whatsapp/ligacao/email/reuniao)
  disparos: number;   // mensagens cad_messages hoje
}

export interface WeekMetrics {
  receita: number;        // receita realizada na semana corrente (seg→hoje)
  disparos: number;       // mensagens enviadas na semana
  contatos: number;       // touchpoints outbound na semana
}

function startOfDayIso(d = new Date()): string {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function endOfDayIso(d = new Date()): string {
  const x = new Date(d); x.setHours(23, 59, 59, 999);
  return x.toISOString();
}
function startOfWeekIso(d = new Date()): string {
  // Semana operacional: segunda-feira 00:00
  const x = new Date(d);
  const dow = x.getDay(); // 0=dom..6=sáb
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
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
  const [cad, tp, cnt] = await Promise.all([
    sb.from("cad_messages" as never)
      .select("id", { count: "exact", head: true })
      .gte("created_at", ini),
    sb.from("prospect_touchpoints" as never)
      .select("id", { count: "exact", head: true })
      .gte("enviado_em", ini)
      .in("tipo", OUTBOUND_TYPES),
    // Receita da semana — tentativa graciosa em contratos/op_contracts.
    sb.from("op_contracts" as never)
      .select("monthly_value, contract_value, signed_at")
      .gte("signed_at", ini),
  ]);
  type Contract = { monthly_value?: number | null; contract_value?: number | null };
  const contratos = ((cnt as { data: Contract[] | null }).data ?? []) as Contract[];
  const receita = contratos.reduce(
    (acc, c) => acc + Number(c.monthly_value ?? c.contract_value ?? 0),
    0,
  );
  return {
    receita,
    disparos: (cad as { count: number | null }).count ?? 0,
    contatos: (tp as { count: number | null }).count ?? 0,
  };
}