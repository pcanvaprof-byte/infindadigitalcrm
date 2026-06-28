import { supabase as sb } from "@/integrations/supabase/client";
import type { DashboardFilters, DashboardV7 } from "./api-v7";

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

export interface DashboardV8 extends DashboardV7 {
  schema: "v8" | "v7";
  scope: UserScope;
  owners_in_scope: string[];
}

export interface DashboardFiltersV8 extends DashboardFilters {
  team_id?: string | null;
}

export async function fetchDashboardV8(filters: DashboardFiltersV8): Promise<DashboardV8> {
  const payload: Record<string, unknown> = {};
  if (filters.preset)     payload.preset = filters.preset;
  if (filters.from)       payload.from = filters.from;
  if (filters.to)         payload.to = filters.to;
  if (filters.owner_name) payload.owner_name = filters.owner_name;
  if (filters.team_id)    payload.team_id = filters.team_id;
  const { data, error } = await rpc("dashboard_metrics_v8", { filters: payload });
  if (error) throw error as Error;
  return data as DashboardV8;
}

export interface TeamRow {
  id: string; name: string; description: string | null;
}
export async function listTeams(): Promise<TeamRow[]> {
  const { data, error } = await sb.from("teams" as never)
    .select("id,name,description").order("name");
  if (error) throw error;
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
  if (error) throw error as Error;
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
  if (error) throw error as Error;
  return (data ?? []) as DashboardAlert[];
}
export async function resolveAlert(id: string): Promise<void> {
  const { error } = await rpc("resolve_alert", { p_id: id });
  if (error) throw error as Error;
}
export async function recomputeAlerts(): Promise<number> {
  const { data, error } = await rpc("compute_dashboard_alerts");
  if (error) throw error as Error;
  return Number(data ?? 0);
}

export const dashboardV8Keys = {
  v8:      (f: DashboardFiltersV8) => ["dashboard", "v8", f] as const,
  teams:   ["dashboard", "teams"] as const,
  ranking: (f: DashboardFiltersV8) => ["dashboard", "ranking-teams", f] as const,
  alerts:  ["dashboard", "alerts"] as const,
};