import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface DashboardKPIs {
  prospectsTotal: number;
  prospectsContacted: number;
  conversationsStarted: number;
  clientsTotal: number;
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
  revenueWon: number;
  pipelineValue: number;
  avgTicket: number;
  meetings: number;
  proposals: number;
  briefingsTotal: number;
  tasksTotal: number;
}

export interface FunnelStage {
  stageId: string;
  label: string;
  count: number;
  value: number;
  position: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface ConversionMetrics {
  prospectsToClients: number; // %
  dealsToWon: number; // %
  meetingsToProposals: number; // %
}

async function uid(): Promise<string | null> {
  const { data } = await sb.auth.getUser();
  return data?.user?.id ?? null;
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const id = await uid();
  if (!id) {
    return {
      prospectsTotal: 0, prospectsContacted: 0, conversationsStarted: 0, clientsTotal: 0,
      dealsOpen: 0, dealsWon: 0, dealsLost: 0,
      revenueWon: 0, pipelineValue: 0, avgTicket: 0,
      meetings: 0, proposals: 0, briefingsTotal: 0, tasksTotal: 0,
    };
  }

  const [pAll, pContacted, convRes, clients, dealsRes, stagesRes, briefingsRes] = await Promise.all([
    sb.from("prospects").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("prospects").select("id", { count: "exact", head: true }).eq("user_id", id).neq("status", "nao_contatado"),
    sb.from("prospect_interactions").select("id", { count: "exact", head: true })
      .eq("user_id", id).in("kind", ["whatsapp", "ligacao", "email"]),
    sb.from("clients").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("deals").select("id, stage_id, value").eq("user_id", id),
    sb.from("deal_stages").select("id, is_won, is_lost, position, label"),
    sb.from("briefings").select("id", { count: "exact", head: true }),
  ]);

  const stages = (stagesRes.data ?? []) as { id: string; is_won: boolean; is_lost: boolean }[];
  const wonIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
  const lostIds = new Set(stages.filter((s) => s.is_lost).map((s) => s.id));

  const deals = (dealsRes.data ?? []) as { id: string; stage_id: string; value: number | string }[];
  let revenueWon = 0, pipelineValue = 0, dealsOpen = 0, dealsWon = 0, dealsLost = 0;
  let meetings = 0, proposals = 0;
  for (const d of deals) {
    const v = Number(d.value || 0);
    if (wonIds.has(d.stage_id)) { dealsWon++; revenueWon += v; }
    else if (lostIds.has(d.stage_id)) { dealsLost++; }
    else { dealsOpen++; pipelineValue += v; }
    if (d.stage_id === "reuniao") meetings++;
    if (d.stage_id === "proposta") proposals++;
  }

  return {
    prospectsTotal: pAll.count ?? 0,
    prospectsContacted: pContacted.count ?? 0,
    conversationsStarted: convRes.count ?? 0,
    clientsTotal: clients.count ?? 0,
    dealsOpen,
    dealsWon,
    dealsLost,
    revenueWon,
    pipelineValue,
    avgTicket: dealsWon ? revenueWon / dealsWon : 0,
    meetings,
    proposals,
    briefingsTotal: briefingsRes.count ?? 0,
    tasksTotal: 0,
  };
}

export async function getPipelineMetrics(): Promise<FunnelStage[]> {
  const id = await uid();
  if (!id) return [];
  const [stagesRes, dealsRes] = await Promise.all([
    sb.from("deal_stages").select("id, label, position, is_won, is_lost").order("position"),
    sb.from("deals").select("stage_id, value").eq("user_id", id),
  ]);
  const stages = (stagesRes.data ?? []) as { id: string; label: string; position: number; is_won: boolean; is_lost: boolean }[];
  const deals = (dealsRes.data ?? []) as { stage_id: string; value: number | string }[];
  return stages.map((s) => {
    const list = deals.filter((d) => d.stage_id === s.id);
    return {
      stageId: s.id,
      label: s.label,
      count: list.length,
      value: list.reduce((acc, d) => acc + Number(d.value || 0), 0),
      position: s.position,
      is_won: s.is_won,
      is_lost: s.is_lost,
    };
  });
}

export async function getConversionMetrics(): Promise<ConversionMetrics> {
  const kpi = await getDashboardKPIs();
  return {
    prospectsToClients: kpi.prospectsTotal ? (kpi.clientsTotal / kpi.prospectsTotal) * 100 : 0,
    dealsToWon: kpi.dealsOpen + kpi.dealsWon + kpi.dealsLost > 0
      ? (kpi.dealsWon / (kpi.dealsOpen + kpi.dealsWon + kpi.dealsLost)) * 100
      : 0,
    meetingsToProposals: kpi.meetings ? (kpi.proposals / kpi.meetings) * 100 : 0,
  };
}