import { supabase as sb } from "@/integrations/supabase/client";

export interface BIGoals {
  revenue_goal: number;
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
}

/** Fallback INFINDA — mantém UI funcional antes da migration rodar. */
export const DEFAULT_GOALS: BIGoals = {
  revenue_goal: 68000,
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
};

const rpc = (sb as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}).rpc.bind(sb);

export async function fetchBIGoals(): Promise<BIGoals> {
  try {
    const now = new Date();
    const { data, error } = await rpc("bi_get_goals", {
      p_year: now.getFullYear(),
      p_month: now.getMonth() + 1,
    });
    if (error || !data) return DEFAULT_GOALS;
    return { ...DEFAULT_GOALS, ...(data as Partial<BIGoals>) };
  } catch {
    return DEFAULT_GOALS;
  }
}