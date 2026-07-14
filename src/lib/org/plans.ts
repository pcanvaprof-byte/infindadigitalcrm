import { useQuery } from "@tanstack/react-query";
import { listMyOrganizations, type OrgPlan, type Organization } from "./api";

export type Feature =
  | "dashboard"
  | "crm"
  | "prospeccao"
  | "cadencia"
  | "operacoes"
  | "briefings"
  | "catalogo"
  | "kickoff"
  | "propostas"
  | "contratos";

/**
 * Plano único INFINDA — R$ 200/mês, todos os módulos liberados.
 * Estas estruturas ficam mantidas por compatibilidade com código legado,
 * mas não restringem mais nada: todas as features são permitidas.
 */
export const ALL_FEATURES: Feature[] = [
  "dashboard",
  "crm",
  "prospeccao",
  "cadencia",
  "operacoes",
  "briefings",
  "catalogo",
  "kickoff",
  "propostas",
  "contratos",
];

export const PLAN_FEATURES: Record<OrgPlan, Feature[]> = {
  start: ALL_FEATURES,
  growth: ALL_FEATURES,
  scale: ALL_FEATURES,
};

export const PLAN_LABEL: Record<OrgPlan, string> = {
  start: "INFINDA",
  growth: "INFINDA",
  scale: "INFINDA",
};

/** Mapa de rotas → feature. Mantido vazio: nenhuma rota é gated por plano. */
export const ROUTE_FEATURE: Record<string, Feature> = {};

export function useActiveOrg() {
  const q = useQuery<Organization[]>({
    queryKey: ["my-organizations"],
    queryFn: listMyOrganizations,
    staleTime: 60_000,
  });
  const orgs = q.data ?? [];
  const active = orgs.find((o) => o.is_active) ?? orgs[0];
  // Plano único: acesso total.
  const plan: OrgPlan = "scale";
  return { org: active, plan, isLoading: q.isLoading };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function planAllows(_plan: OrgPlan, _feature: Feature): boolean {
  return true;
}