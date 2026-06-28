import { supabase as sb } from "@/integrations/supabase/client";

// As novas RPCs (v7) ainda nao estao no schema gerado em src/integrations/supabase/types.ts.
// Usamos um proxy `any` so para essas chamadas, mantendo todo o resto com tipagem real.
const rpc = (sb as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}).rpc.bind(sb);

export type Preset = "hoje" | "ontem" | "semana" | "mes" | "trimestre" | "ano";

export interface DashboardFilters {
  preset?: Preset;
  from?: string; // ISO
  to?: string;
  owner_name?: string | null;
}

export interface DashboardV7 {
  schema: "v7";
  org_id: string;
  janela: { from: string; to: string; preset: Preset };
  filtros_aplicados: { owner_name: string | null };
  contatos: { hoje: number; semana: number; mes: number; periodo: number };
  respostas: { hoje: number; semana: number; mes: number; periodo: number; taxa: number };
  resumo: {
    base: number; contatados: number; respondidos: number;
    novos: number; interessados: number; em_negociacao: number;
    ativos: number; perdidos: number;
  };
  pipeline: Record<string, number>;
  gargalos: {
    cadencia_atrasada: number; parados_30d: number; sem_responsavel: number;
    clients_parados_15d: number; sem_proxima_acao: number;
  };
  conversao: {
    base_contato: number; contato_resposta: number;
    resposta_interesse: number; interesse_proposta: number; proposta_ativo: number;
  };
  kpis_gerencial: {
    taxa_resposta: number;
    taxa_conversao: number;
    taxa_fechamento: number;
    ticket_medio: number;
    tempo_medio_fechamento_d: number;
    tempo_medio_primeira_resposta_d: number;
    ciclo_medio_venda_d: number;
    clientes_ganhos: number;
    clientes_perdidos: number;
    receita_periodo: number;
    roi_comercial: number | null;
  };
  series: {
    evolucao_diaria: Array<{ day: string; contatos: number; respostas: number; ganhos: number }>;
    evolucao_mensal: Array<{ month: string; contatos: number; respostas: number; ganhos: number }>;
    ranking: Array<{ owner_name: string; ganhos: number; perdidos: number; base: number }>;
    funil: Array<{ etapa: string; valor: number }>;
  };
  comparacao: {
    atual:    { contatos: number; respostas: number; ganhos: number; perdidos: number; receita: number };
    anterior: { contatos: number; respostas: number; ganhos: number; perdidos: number; receita: number };
  };
  metas: {
    mes_ano: { year: number; month: number };
    meta_receita: number; meta_clientes: number; meta_contatos: number;
    custo_marketing: number;
    realizado_receita: number; realizado_clientes: number; realizado_contatos: number;
  };
}

export async function fetchDashboardV7(filters: DashboardFilters): Promise<DashboardV7> {
  const payload: Record<string, unknown> = {};
  if (filters.preset)     payload.preset = filters.preset;
  if (filters.from)       payload.from = filters.from;
  if (filters.to)         payload.to = filters.to;
  if (filters.owner_name) payload.owner_name = filters.owner_name;
  const { data, error } = await rpc("dashboard_metrics_v7", { filters: payload });
  if (error) throw error as Error;
  return data as unknown as DashboardV7;
}

export interface FilterOptions {
  vendedores: Array<{ owner_name: string }>;
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const { data, error } = await rpc("dashboard_filters_options");
  if (error) throw error as Error;
  return (data ?? { vendedores: [] }) as FilterOptions;
}

export async function upsertOrgGoal(input: {
  year: number; month: number;
  meta_receita: number; meta_clientes: number;
  meta_contatos: number; custo_marketing: number;
}): Promise<void> {
  const { error } = await rpc("upsert_org_goal", {
    p_year: input.year,
    p_month: input.month,
    p_meta_receita: input.meta_receita,
    p_meta_clientes: input.meta_clientes,
    p_meta_contatos: input.meta_contatos,
    p_custo_marketing: input.custo_marketing,
  });
  if (error) throw error as Error;
}

export const dashboardKeys = {
  v7: (f: DashboardFilters) => ["dashboard", "v7", f] as const,
  options: ["dashboard", "filter-options"] as const,
};