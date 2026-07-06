import { supabase } from "@/integrations/supabase/client";

type Row = {
  valor: number | string;
  vencimento: string;    // YYYY-MM-DD
  status: "pendente" | "pago" | "atrasado" | "bonificado" | "cancelado";
  pago_em: string | null;
  tipo: "implantacao" | "mensalidade" | "avulso";
};

export interface BillingKpis {
  recebido_mes: number;
  bonificado_mes: number;
  atrasado_total: number;
  a_receber_total: number;
  previsao_30d: number;      // pendentes com vencimento nos próximos 30 dias
  previsao_90d: number;      // pendentes com vencimento nos próximos 90 dias
  mrr_ativo: number;         // média mensal das mensalidades pendentes/pagas nos próximos 90 dias
  total_parcelas: number;
  por_mes: Array<{
    ym: string;
    recebido: number;
    a_receber: number;
    atrasado: number;
    bonificado: number;
    total: number;
  }>;
}

const EMPTY: BillingKpis = {
  recebido_mes: 0, bonificado_mes: 0, atrasado_total: 0, a_receber_total: 0,
  previsao_30d: 0, previsao_90d: 0, mrr_ativo: 0, total_parcelas: 0, por_mes: [],
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function fetchBillingKpis(): Promise<BillingKpis> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("client_billing_items")
    .select("valor,vencimento,status,pago_em,tipo")
    .limit(10000);
  if (error || !data) return EMPTY;

  const rows = data as Row[];
  const today = todayISO();
  const in30 = addDaysISO(today, 30);
  const in90 = addDaysISO(today, 90);
  const monthStart = today.slice(0, 7) + "-01";
  const monthEnd = today.slice(0, 7) + "-31";

  const acc = { ...EMPTY, por_mes: [] as BillingKpis["por_mes"] };
  const monthly = new Map<string, BillingKpis["por_mes"][number]>();
  let mensalidade90 = 0;

  for (const r of rows) {
    const v = Number(r.valor) || 0;
    const status = r.status;
    if (status === "cancelado") continue;

    const ym = r.vencimento.slice(0, 7);
    const bucket = monthly.get(ym) ?? { ym, recebido: 0, a_receber: 0, atrasado: 0, bonificado: 0, total: 0 };
    bucket.total += v;

    if (status === "pago") {
      const pagoYm = (r.pago_em ?? r.vencimento).slice(0, 7);
      const pagoBucket = monthly.get(pagoYm) ?? { ym: pagoYm, recebido: 0, a_receber: 0, atrasado: 0, bonificado: 0, total: 0 };
      pagoBucket.recebido += v;
      monthly.set(pagoYm, pagoBucket);
      if ((r.pago_em ?? r.vencimento) >= monthStart && (r.pago_em ?? r.vencimento) <= monthEnd) {
        acc.recebido_mes += v;
      }
    } else if (status === "bonificado") {
      bucket.bonificado += v;
      if (r.vencimento >= monthStart && r.vencimento <= monthEnd) acc.bonificado_mes += v;
    } else {
      // pendente ou atrasado
      const overdue = r.vencimento < today;
      if (overdue) {
        bucket.atrasado += v;
        acc.atrasado_total += v;
      } else {
        bucket.a_receber += v;
        acc.a_receber_total += v;
        if (r.vencimento <= in30) acc.previsao_30d += v;
        if (r.vencimento <= in90) {
          acc.previsao_90d += v;
          if (r.tipo === "mensalidade") mensalidade90 += v;
        }
      }
    }

    monthly.set(ym, bucket);
    acc.total_parcelas += 1;
  }

  acc.mrr_ativo = Math.round(mensalidade90 / 3);
  acc.por_mes = [...monthly.values()].sort((a, b) => a.ym.localeCompare(b.ym));
  return acc;
}
