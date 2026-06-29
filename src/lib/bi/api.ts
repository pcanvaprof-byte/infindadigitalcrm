import { supabase as sb } from "@/integrations/supabase/client";

const rpc = (sb as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}).rpc.bind(sb);

export type BIArea = "comercial" | "financeiro" | "marketing" | "operacoes" | "diretoria";

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