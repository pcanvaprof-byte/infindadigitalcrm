import { supabase as sb } from "@/integrations/supabase/client";

export interface BIGoals {
  revenue_goal: number;
  recurring_revenue_goal: number;
  contracts_goal: number;
  leads_goal: number;
  meetings_goal: number;
  proposals_goal: number;
  clients_goal: number;
  roas_goal: number;
  cac_goal: number;
  ltv_goal: number;
  ticket_goal: number;
  weekly_revenue_goal: number;
  weekly_contracts_goal: number;
  weekly_visits_goal: number;
  weekly_contacts_goal: number;
  weekly_dispatches_goal: number;
  weekly_new_contacts_goal: number;
  weekly_companies_goal: number;
  weekly_videos_goal: number;
  weekly_partnerships_goal: number;
  daily_visits_goal: number;
  daily_contacts_goal: number;
  payroll_cost: number;
  infra_cost: number;
  taxes_pct: number;
}

/** Fallback INFINDA — mantém UI funcional antes da migration rodar. */
export const DEFAULT_GOALS: BIGoals = {
  revenue_goal: 68000,
  recurring_revenue_goal: 0,
  contracts_goal: 16,
  leads_goal: 700,
  meetings_goal: 100,
  proposals_goal: 50,
  clients_goal: 0,
  roas_goal: 3,
  cac_goal: 0,
  ltv_goal: 0,
  ticket_goal: 4250,
  weekly_revenue_goal: 17000,
  weekly_contracts_goal: 4,
  weekly_visits_goal: 150,
  weekly_contacts_goal: 200,
  weekly_dispatches_goal: 240,
  weekly_new_contacts_goal: 50,
  weekly_companies_goal: 180,
  weekly_videos_goal: 2,
  weekly_partnerships_goal: 1,
  daily_visits_goal: 30,
  daily_contacts_goal: 40,
  payroll_cost: 0,
  infra_cost: 0,
  taxes_pct: 0,
};

const rpc = (sb as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}).rpc.bind(sb);

const LOCAL_KEY = "bi.goals.overrides.v1";
const CLEANUP_MARKER = "bi.goals.cleanup.mrr10k.v1";

/** Limpeza one-shot: zera override antigo de 10k em recurring_revenue_goal. */
function migrateStaleMrr10k() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(CLEANUP_MARKER)) return;
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Partial<BIGoals>;
      if (obj && obj.recurring_revenue_goal === 10000) {
        delete obj.recurring_revenue_goal;
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(obj));
      }
    }
    window.localStorage.setItem(CLEANUP_MARKER, "1");
  } catch {
    /* ignore */
  }
}

function readLocalOverrides(): Partial<BIGoals> {
  if (typeof window === "undefined") return {};
  migrateStaleMrr10k();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Partial<BIGoals>) : {};
  } catch {
    return {};
  }
}

function writeLocalOverrides(next: Partial<BIGoals>) {
  if (typeof window === "undefined") return;
  try {
    const merged = { ...readLocalOverrides(), ...next };
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("bi-goals-changed", { detail: merged }));
  } catch {
    /* ignore */
  }
}

export const BI_GOALS_EVENT = "bi-goals-changed";

export async function fetchBIGoals(): Promise<BIGoals> {
  const local = readLocalOverrides();
  try {
    const now = new Date();
    const { data, error } = await rpc("bi_get_goals", {
      p_year: now.getFullYear(),
      p_month: now.getMonth() + 1,
    });
    if (error || !data) return { ...DEFAULT_GOALS, ...local };
    return { ...DEFAULT_GOALS, ...(data as Partial<BIGoals>), ...local };
  } catch {
    return { ...DEFAULT_GOALS, ...local };
  }
}

export async function saveMonthlyGoals(input: {
  year: number;
  month: number;
  revenue: number;
  recurring: number;
  contracts: number;
  leads: number;
  meetings: number;
  ticket: number;
  payroll?: number;
  infra?: number;
  taxesPct?: number;
  weeklyRevenue?: number;
  dailyVisits?: number;
  dailyContacts?: number;
  weeklyDispatches?: number;
  weeklyContracts?: number;
  weeklyCompanies?: number;
  weeklyVideos?: number;
  weeklyPartnerships?: number;
  weeklyNewContacts?: number;
}): Promise<{ ok: boolean; error?: string }> {
  // Persistência local imediata — garante que a meta editada seja refletida no Cockpit
  // mesmo quando a RPC `bi_set_monthly_goals` não está disponível no banco.
  // Persistência local — só grava campos REALMENTE informados. Nunca sobrescreve
  // com defaults silenciosos, que apagariam edições anteriores do usuário.
  const overrides: Partial<BIGoals> = {
    revenue_goal: input.revenue,
    recurring_revenue_goal: input.recurring,
    contracts_goal: input.contracts,
    leads_goal: input.leads,
    meetings_goal: input.meetings,
    ticket_goal: input.ticket,
  };
  if (input.payroll !== undefined) overrides.payroll_cost = input.payroll;
  if (input.infra !== undefined) overrides.infra_cost = input.infra;
  if (input.taxesPct !== undefined) overrides.taxes_pct = input.taxesPct;
  if (input.weeklyRevenue !== undefined) overrides.weekly_revenue_goal = input.weeklyRevenue;
  if (input.dailyVisits !== undefined) overrides.daily_visits_goal = input.dailyVisits;
  if (input.dailyContacts !== undefined) overrides.daily_contacts_goal = input.dailyContacts;
  if (input.weeklyDispatches !== undefined) overrides.weekly_dispatches_goal = input.weeklyDispatches;
  if (input.weeklyContracts !== undefined) overrides.weekly_contracts_goal = input.weeklyContracts;
  if (input.weeklyCompanies !== undefined) overrides.weekly_companies_goal = input.weeklyCompanies;
  if (input.weeklyVideos !== undefined) overrides.weekly_videos_goal = input.weeklyVideos;
  if (input.weeklyPartnerships !== undefined) overrides.weekly_partnerships_goal = input.weeklyPartnerships;
  if (input.weeklyNewContacts !== undefined) overrides.weekly_new_contacts_goal = input.weeklyNewContacts;
  writeLocalOverrides(overrides);

  // Tenta persistir remotamente. Erros são propagados (sem mascarar).
  try {
    const { error } = await rpc("bi_set_monthly_goals", {
      p_year: input.year,
      p_month: input.month,
      p_revenue: input.revenue,
      p_recurring: input.recurring,
      p_contracts: input.contracts,
      p_leads: input.leads,
      p_meetings: input.meetings,
      p_ticket: input.ticket,
      p_payroll: input.payroll,
      p_infra: input.infra,
      p_taxes_pct: input.taxesPct,
      p_weekly_revenue: input.weeklyRevenue,
      p_daily_visits: input.dailyVisits,
      p_daily_contacts: input.dailyContacts,
      p_weekly_dispatches: input.weeklyDispatches,
    });
    if (error) {
      const msg = (error as { message?: string }).message ?? "RPC bi_set_monthly_goals indisponível";
      // Persistência local ok — sucesso parcial sinalizado claramente.
      return { ok: true, error: `Salvo localmente (${msg})` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[saveMonthlyGoals] RPC falhou:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: true, error: `Salvo localmente (${msg})` };
  }
}