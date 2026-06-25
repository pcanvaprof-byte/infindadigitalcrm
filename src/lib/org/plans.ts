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

export const PLAN_FEATURES: Record<OrgPlan, Feature[]> = {
  start: ["dashboard", "crm", "prospeccao"],
  growth: [
    "dashboard",
    "crm",
    "prospeccao",
    "cadencia",
    "operacoes",
    "briefings",
    "catalogo",
    "kickoff",
    "propostas",
  ],
  scale: [
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
  ],
};

export const PLAN_LABEL: Record<OrgPlan, string> = {
  start: "INFINDA Start",
  growth: "INFINDA Growth",
  scale: "INFINDA Scale",
};

/** Mapa de rotas → feature. Rotas ausentes não são restringidas. */
export const ROUTE_FEATURE: Record<string, Feature> = {
  "/dashboard": "dashboard",
  "/crm": "crm",
  "/prospeccao": "prospeccao",
  "/cadencia": "cadencia",
  "/operacoes": "operacoes",
  "/briefings": "briefings",
  "/catalogo": "catalogo",
  "/kickoff": "kickoff",
  "/propostas": "propostas",
  "/contratos": "contratos",
};

export function useActiveOrg() {
  const q = useQuery<Organization[]>({
    queryKey: ["my-organizations"],
    queryFn: listMyOrganizations,
    staleTime: 60_000,
  });
  const orgs = q.data ?? [];
  const active = orgs.find((o) => o.is_active) ?? orgs[0];
  // fallback: assume scale (acesso total) quando não há plano definido
  const plan: OrgPlan = (active?.plan as OrgPlan) ?? "scale";
  return { org: active, plan, isLoading: q.isLoading };
}

export function planAllows(plan: OrgPlan, feature: Feature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}
