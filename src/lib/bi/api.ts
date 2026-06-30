import { supabase as sb } from "@/integrations/supabase/client";
import { localTimestamp } from "./tz";
import type { ResolvedPeriod } from "./period";

const rpc = (sb as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}).rpc.bind(sb);

export type BIArea = "comercial" | "financeiro" | "marketing" | "operacoes" | "diretoria" | "meios";

export interface BIDashboardPayload {
  kpis?: {
    clientes_ativos: number; ticket_medio: number; mrr: number; arr: number;
    receita_realizada: number; receita_prevista_mes: number;
    custo_marketing: number; cac: number; ltv: number; roi: number; payback_meses: number;
  };
  forecast?: {
    pipeline_aberto: number; taxa_conversao_historica: number;
    previsao_30d: number; previsao_90d: number; mrr: number; arr: number;
  };
  funnel?: Array<{ stage: string; clientes: number; tempo_medio_dias: number }>;
  lost?: { total: number; valor_perdido: number; recentes: Array<Record<string, unknown>> };
  churn?: {
    alto: number; medio: number; baixo: number;
    detalhes: Array<{ id: string; empresa: string; valor: number; dias_sem_update: number; risco: string }>;
  };
  best_hours?: Array<{ hora: number; enviados: number; respondidos: number; taxa_resposta: number | null }>;
  best_channels?: Array<{ canal: string; enviados: number; respondidos: number; taxa_resposta: number | null }>;
  top_campaigns?: Array<{ campanha: string; status: string; clientes: number; receita: number }>;
}

export async function fetchBIDashboard(area: BIArea): Promise<BIDashboardPayload> {
  // Auditoria 2026-06-29: a RPC `bi_dashboard` não existe no banco (pg_proc vazio),
  // por isso retornava 42703 "column 'empresa' does not exist" em todas as abas e
  // fazia o app cair em fallback client-side a cada render. Enquanto a RPC não for
  // (re)criada, devolvemos payload vazio diretamente — os painéis já consomem as
  // fontes canônicas (`fetchDiretoriaKpis`, `fetchForecastForPeriod`, charts).
  void area;
  void rpc;
  return {};
}

/**
 * Funil comercial real, computado client-side a partir das tabelas canônicas:
 * - Leads      → prospects criados no período (+ cad_leads sem prospect_id)
 * - Reuniões   → prospect_touchpoints tipo=reuniao no período
 * - Propostas  → proposals criadas no período
 * - Contratos  → contracts/op_contracts assinados no período
 * Mantém a aba Comercial em sincronia com Hoje/Semana/Mês/Trimestre.
 */
export async function fetchComercialFunnel(
  period: ResolvedPeriod,
): Promise<NonNullable<BIDashboardPayload["funnel"]>> {
  const ini = localTimestamp(new Date(new Date(period.from).setHours(0, 0, 0, 0)));
  const fim = localTimestamp(new Date(new Date(period.to).setHours(23, 59, 59, 999)));

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[bi:comercial] funil ${period.preset ?? "custom"}`);
  // eslint-disable-next-line no-console
  console.log("[bi:comercial] período recebido", {
    preset: period.preset,
    from: period.from,
    to: period.to,
    ini,
    fim,
    tz,
  });

  const safeCount = async (
    table: string,
    col: string,
    extra?: (q: unknown) => unknown,
    extraLabel?: string,
  ): Promise<number> => {
    const label = `${table}.${col}${extraLabel ? ` [${extraLabel}]` : ""}`;
    try {
      let q = (sb as unknown as {
        from: (t: string) => {
          select: (c: string, o?: Record<string, unknown>) => {
            gte: (c: string, v: string) => unknown;
          };
        };
      })
        .from(table)
        .select("id", { count: "exact", head: true })
        .gte(col, ini);
      q = (q as { lte: (c: string, v: string) => unknown }).lte(col, fim) as never;
      if (extra) q = extra(q) as never;
      const res = (await (q as unknown as Promise<{ count: number | null; error: { message?: string } | null }>));
      if (res.error) {
        // eslint-disable-next-line no-console
        console.warn(`[bi:comercial] ${label} ERRO`, res.error.message ?? res.error);
        return 0;
      }
      // eslint-disable-next-line no-console
      console.log(`[bi:comercial] ${label} → ${res.count ?? 0}`);
      return res.count ?? 0;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[bi:comercial] ${label} EXCEPTION`, e);
      return 0;
    }
  };

  const [
    prospectsCount,
    cadLeadsOrphan,
    reunioes,
    propostas,
    contratos,
    opContratos,
  ] = await Promise.all([
    safeCount("prospects", "created_at"),
    safeCount(
      "cad_leads",
      "created_at",
      (q) => (q as { is: (c: string, v: unknown) => unknown }).is("prospect_id", null),
      "prospect_id IS NULL",
    ),
    safeCount(
      "prospect_touchpoints",
      "enviado_em",
      (q) => (q as { eq: (c: string, v: unknown) => unknown }).eq("tipo", "reuniao"),
      "tipo=reuniao",
    ),
    safeCount("proposals", "created_at"),
    safeCount("contracts", "signed_at"),
    safeCount("op_contracts", "signed_at"),
  ]);

  const leads = prospectsCount + cadLeadsOrphan;
  // contracts (legado) e op_contracts (Operações) podem coexistir; somamos os
  // dois — `fetchForecastForPeriod` aplica a mesma união para o valor fechado.
  const contratosTotal = contratos + opContratos;
  // eslint-disable-next-line no-console
  console.log("[bi:comercial] resumo", {
    leads, reunioes, propostas, contratosTotal,
    breakdown: { prospectsCount, cadLeadsOrphan, contratos, opContratos },
  });
  // eslint-disable-next-line no-console
  console.groupEnd();

  return [
    { stage: "Leads", clientes: leads, tempo_medio_dias: 0 },
    { stage: "Reuniões", clientes: reunioes, tempo_medio_dias: 0 },
    { stage: "Propostas", clientes: propostas, tempo_medio_dias: 0 },
    { stage: "Contratos", clientes: contratosTotal, tempo_medio_dias: 0 },
  ];
}

export interface AIInsight {
  id: string;
  area: BIArea;
  summary: string;
  recommendations: string[];
  created_at: string;
}

export async function listAIInsights(area: BIArea): Promise<AIInsight[]> {
  const { data, error } = await sb
    .from("ai_insights" as never)
    .select("id,area,summary,recommendations,created_at")
    .eq("area", area)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return ((data ?? []) as unknown as AIInsight[]).map((r) => ({
    ...r,
    recommendations: Array.isArray(r.recommendations) ? r.recommendations : [],
  }));
}