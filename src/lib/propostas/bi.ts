/**
 * Camada de leitura BI — consome apenas vw_* (verdade única no DB).
 *
 * Regra Etapa 6: o frontend NÃO recalcula KPIs. Toda agregação vive em SQL
 * (scripts/migrations/20260701_proposta_bi_views.sql) e respeita o EBD.
 */
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface ProposalKPIs {
  total: number;
  rascunho: number;
  enviadas: number;
  visualizadas: number;
  aprovadas: number;
  rejeitadas: number;
  expiradas: number;
  valor_total_enviado: number;
  valor_total_aprovado: number;
  valor_perdido: number;
  ticket_medio: number;
  taxa_aprovacao: number;
}

export interface ProposalConversion {
  enviadas: number;
  visualizadas: number;
  decididas: number;
  tempo_medio_visualizacao_h: number;
  tempo_medio_decisao_h: number;
}

export interface ProposalFunnelRow {
  status: string;
  total: number;
  valor_total: number;
}

export interface ProposalTimelineEvent {
  id: string;
  proposal_id: string;
  event_type: string;
  actor_type: string | null;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface RevenueForecastRow {
  tipo: "implantacao" | "mrr" | "avulso";
  competencia_mes: string;
  propostas: number;
  valor: number;
}

const EMPTY_KPIS: ProposalKPIs = {
  total: 0, rascunho: 0, enviadas: 0, visualizadas: 0,
  aprovadas: 0, rejeitadas: 0, expiradas: 0,
  valor_total_enviado: 0, valor_total_aprovado: 0, valor_perdido: 0,
  ticket_medio: 0, taxa_aprovacao: 0,
};

const EMPTY_CONV: ProposalConversion = {
  enviadas: 0, visualizadas: 0, decididas: 0,
  tempo_medio_visualizacao_h: 0, tempo_medio_decisao_h: 0,
};

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const biKeys = {
  kpis: ["bi", "proposal", "kpis"] as const,
  conversion: ["bi", "proposal", "conversion"] as const,
  funnel: ["bi", "proposal", "funnel"] as const,
  timeline: (id: string) => ["bi", "proposal", "timeline", id] as const,
  revenue: ["bi", "proposal", "revenue"] as const,
};

/** vw_proposal_kpis (filtrada por RLS para o usuário corrente). */
export async function fetchProposalKPIs(): Promise<ProposalKPIs> {
  const { data, error } = await sb.from("vw_proposal_kpis").select("*").maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_KPIS;
  return {
    total: num(data.total),
    rascunho: num(data.rascunho),
    enviadas: num(data.enviadas),
    visualizadas: num(data.visualizadas),
    aprovadas: num(data.aprovadas),
    rejeitadas: num(data.rejeitadas),
    expiradas: num(data.expiradas),
    valor_total_enviado: num(data.valor_total_enviado),
    valor_total_aprovado: num(data.valor_total_aprovado),
    valor_perdido: num(data.valor_perdido),
    ticket_medio: num(data.ticket_medio),
    taxa_aprovacao: num(data.taxa_aprovacao),
  };
}

export async function fetchProposalConversion(): Promise<ProposalConversion> {
  const { data, error } = await sb.from("vw_proposal_conversion").select("*").maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_CONV;
  return {
    enviadas: num(data.enviadas),
    visualizadas: num(data.visualizadas),
    decididas: num(data.decididas),
    tempo_medio_visualizacao_h: num(data.tempo_medio_visualizacao_h),
    tempo_medio_decisao_h: num(data.tempo_medio_decisao_h),
  };
}

export async function fetchProposalFunnel(): Promise<ProposalFunnelRow[]> {
  const { data, error } = await sb.from("vw_proposal_funnel_full").select("status,total,valor_total");
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    status: String(r.status ?? ""),
    total: num(r.total),
    valor_total: num(r.valor_total),
  }));
}

/** Timeline reproduzível: 100% de evt_* da proposta, ordenado asc. */
export async function fetchProposalTimeline(proposalId: string): Promise<ProposalTimelineEvent[]> {
  const { data, error } = await sb
    .from("vw_proposal_timeline")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProposalTimelineEvent[];
}

export async function fetchRevenueForecast(): Promise<RevenueForecastRow[]> {
  const { data, error } = await sb
    .from("vw_proposal_revenue_forecast")
    .select("tipo,competencia_mes,propostas,valor")
    .order("competencia_mes", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    tipo: r.tipo as RevenueForecastRow["tipo"],
    competencia_mes: String(r.competencia_mes ?? ""),
    propostas: num(r.propostas),
    valor: num(r.valor),
  }));
}