import { supabase as sb } from "@/integrations/supabase/client";
import { fetchDashboardV7, type DashboardFilters, type DashboardV7, type Preset } from "./api-v7";

const rpc = (sb as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}).rpc.bind(sb);

export type UserRole =
  | "admin" | "diretor" | "gestor" | "supervisor" | "vendedor" | "consultor" | "none";

export interface UserScope {
  org_id: string | null;
  user_id: string | null;
  role: UserRole;
  teams: string[];
  owners: string[];
  my_owner: string | null;
}

export interface DashboardV8 extends Omit<DashboardV7, "schema"> {
  schema: "v8" | "v7";
  scope: UserScope;
  owners_in_scope: string[];
}

export interface DashboardFiltersV8 extends DashboardFilters {
  team_id?: string | null;
}

function isMissingDbFeature(error: unknown): boolean {
  if (!error) return false;
  const maybe = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const text = [maybe.code, maybe.message, maybe.details, maybe.hint]
    .filter(Boolean)
    .map(String)
    .join(" ");
  return (
    text.includes("PGRST202") ||
    text.includes("404") ||
    text.includes("Could not find") ||
    text.includes("does not exist") ||
    text.includes("dashboard_metrics_v8") ||
    text.includes("dashboard_metrics_v7") ||
    text.includes("ranking_teams") ||
    text.includes("list_active_alerts") ||
    text.includes("compute_dashboard_alerts") ||
    text.includes("resolve_alert") ||
    text.includes("teams") ||
    text.includes("dashboard_alerts")
  );
}

function emptyV7Sections(base: DashboardV6Compat): Pick<DashboardV7, "janela" | "filtros_aplicados" | "kpis_gerencial" | "series" | "comparacao" | "metas"> {
  const now = new Date();
  const today = now.toISOString();
  const contatados = base.resumo?.contatados ?? 0;
  const respondidos = base.resumo?.respondidos ?? 0;
  const ativos = base.resumo?.ativos ?? 0;
  const perdidos = base.resumo?.perdidos ?? 0;
  const baseTotal = base.resumo?.base ?? 0;
  return {
    janela: { from: today, to: today, preset: "mes" as Preset },
    filtros_aplicados: { owner_name: null },
    kpis_gerencial: {
      taxa_resposta: contatados ? Number(((respondidos / contatados) * 100).toFixed(1)) : 0,
      taxa_conversao: baseTotal ? Number(((ativos / baseTotal) * 100).toFixed(2)) : 0,
      taxa_fechamento: ativos + perdidos ? Number(((ativos / (ativos + perdidos)) * 100).toFixed(1)) : 0,
      ticket_medio: 0,
      tempo_medio_fechamento_d: 0,
      tempo_medio_primeira_resposta_d: 0,
      ciclo_medio_venda_d: 0,
      clientes_ganhos: ativos,
      clientes_perdidos: perdidos,
      receita_periodo: 0,
      roi_comercial: null,
    },
    series: {
      evolucao_diaria: [],
      evolucao_mensal: [],
      ranking: [],
      funil: [
        { etapa: "Base", valor: base.resumo?.base ?? 0 },
        { etapa: "Contatados", valor: base.resumo?.contatados ?? 0 },
        { etapa: "Responderam", valor: base.resumo?.respondidos ?? 0 },
        { etapa: "Interessados", valor: base.resumo?.interessados ?? 0 },
        { etapa: "Em negociação", valor: base.resumo?.em_negociacao ?? 0 },
        { etapa: "Ativos", valor: base.resumo?.ativos ?? 0 },
      ],
    },
    comparacao: {
      atual: { contatos: base.contatos?.mes ?? 0, respostas: base.respostas?.mes ?? 0, ganhos: ativos, perdidos, receita: 0 },
      anterior: { contatos: 0, respostas: 0, ganhos: 0, perdidos: 0, receita: 0 },
    },
    metas: {
      mes_ano: { year: now.getFullYear(), month: now.getMonth() + 1 },
      meta_receita: 0,
      meta_clientes: 0,
      meta_contatos: 0,
      custo_marketing: 0,
      realizado_receita: 0,
      realizado_clientes: ativos,
      realizado_contatos: base.contatos?.mes ?? 0,
    },
  };
}

type DashboardV6Compat = Pick<DashboardV7, "org_id" | "contatos" | "respostas" | "resumo" | "pipeline" | "gargalos" | "conversao"> & {
  schema: string;
};

function withV8Scope(data: DashboardV7): DashboardV8 {
  const existing = data as DashboardV7 & Partial<DashboardV8>;
  return {
    ...data,
    schema: String(existing.schema) === "v8" ? "v8" : "v7",
    scope: existing.scope ?? {
      org_id: data.org_id,
      user_id: null,
      role: "vendedor",
      teams: [],
      owners: [],
      my_owner: null,
    },
    owners_in_scope: existing.owners_in_scope ?? data.series.ranking.map((r) => r.owner_name).filter(Boolean),
  };
}

async function fetchDashboardV6Compat(): Promise<DashboardV8> {
  const { data, error } = await rpc("dashboard_metrics");
  if (error) throw error as Error;
  const base = data as DashboardV6Compat;
  return withV8Scope({
    ...base,
    schema: "v7",
    ...emptyV7Sections(base),
  });
}

export async function fetchDashboardV8(filters: DashboardFiltersV8): Promise<DashboardV8> {
  const payload: Record<string, unknown> = {};
  if (filters.preset)     payload.preset = filters.preset;
  if (filters.from)       payload.from = filters.from;
  if (filters.to)         payload.to = filters.to;
  if (filters.owner_name) payload.owner_name = filters.owner_name;
  if (filters.team_id)    payload.team_id = filters.team_id;
  const { data, error } = await rpc("dashboard_metrics_v8", { filters: payload });
  if (!error) return withV8Scope(data as DashboardV7);
  if (!isMissingDbFeature(error)) throw error as Error;

  try {
    return withV8Scope(await fetchDashboardV7(filters));
  } catch (v7Error) {
    if (!isMissingDbFeature(v7Error)) throw v7Error;
    return fetchDashboardV6Compat();
  }
}

export interface TeamRow {
  id: string; name: string; description: string | null;
}
export async function listTeams(): Promise<TeamRow[]> {
  const { data, error } = await sb.from("teams" as never)
    .select("id,name,description").order("name");
  if (error) {
    if (isMissingDbFeature(error)) return [];
    throw error;
  }
  return (data ?? []) as TeamRow[];
}

export interface TeamRankingRow {
  team_id: string; team_name: string;
  contatos: number; respostas: number;
  ganhos: number; perdidos: number; receita: number;
}
export async function fetchTeamRanking(filters: DashboardFiltersV8): Promise<TeamRankingRow[]> {
  const payload: Record<string, unknown> = {};
  if (filters.from) payload.from = filters.from;
  if (filters.to)   payload.to   = filters.to;
  const { data, error } = await rpc("ranking_teams", { filters: payload });
  if (error) {
    if (isMissingDbFeature(error)) return [];
    throw error as Error;
  }
  return ((data as { teams?: TeamRankingRow[] })?.teams ?? []);
}

export interface DashboardAlert {
  id: string;
  kind: "queda_conversao" | "vendedor_sem_atividade" | "meta_em_risco"
      | "pipeline_parado" | "cliente_sem_followup";
  severity: "info" | "warn" | "danger";
  scope: "org" | "team" | "user" | "client";
  scope_ref: string | null;
  title: string;
  detail: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
}
export async function listActiveAlerts(): Promise<DashboardAlert[]> {
  const { data, error } = await rpc("list_active_alerts");
  if (error) {
    if (isMissingDbFeature(error)) return [];
    throw error as Error;
  }
  return (data ?? []) as DashboardAlert[];
}
export async function resolveAlert(id: string): Promise<void> {
  const { error } = await rpc("resolve_alert", { p_id: id });
  if (error && !isMissingDbFeature(error)) throw error as Error;
}
export async function recomputeAlerts(): Promise<number> {
  const { data, error } = await rpc("compute_dashboard_alerts");
  if (error) {
    if (isMissingDbFeature(error)) return 0;
    throw error as Error;
  }
  return Number(data ?? 0);
}

export const dashboardV8Keys = {
  v8:      (f: DashboardFiltersV8) => ["dashboard", "v8", f] as const,
  teams:   ["dashboard", "teams"] as const,
  ranking: (f: DashboardFiltersV8) => ["dashboard", "ranking-teams", f] as const,
  alerts:  ["dashboard", "alerts"] as const,
};