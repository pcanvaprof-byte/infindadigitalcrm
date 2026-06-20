import type { DealWithClient, Client, DealStage } from "@/lib/crm/api";
import type { Prospect } from "@/lib/mock-prospects";
import type { MapPoint } from "@/lib/tasks-map-api";
import type { Briefing } from "@/lib/briefings/types";

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

export interface DashboardInputs {
  deals: DealWithClient[];
  prospects: Prospect[];
  clients: Client[];
  tasks: MapPoint[];
  briefings: Briefing[];
  stages: DealStage[];
}

export interface DashboardMetrics {
  kpis: DashboardKPIs;
  funnel: FunnelStage[];
  conversion: ConversionMetrics;
}

const EMPTY_KPIS: DashboardKPIs = {
  prospectsTotal: 0, prospectsContacted: 0, conversationsStarted: 0, clientsTotal: 0,
  dealsOpen: 0, dealsWon: 0, dealsLost: 0,
  revenueWon: 0, pipelineValue: 0, avgTicket: 0,
  meetings: 0, proposals: 0, briefingsTotal: 0, tasksTotal: 0,
};

const CLIENT_PIPELINE_STATUSES = new Set<Prospect["status"]>([
  "fechado_ganho",
  "aguardando_kickoff",
  "aguardando_producao",
  "em_producao",
  "entregue",
  "cliente",
]);

const PROPOSAL_PIPELINE_STATUSES = new Set<Prospect["status"]>([
  "proposta_pendente",
  "proposta_enviada",
  ...CLIENT_PIPELINE_STATUSES,
]);

const MEETING_PIPELINE_STATUSES = new Set<Prospect["status"]>([
  "agendado",
  "briefing_enviado",
  "diagnostico_pendente",
  ...PROPOSAL_PIPELINE_STATUSES,
]);

/**
 * Pura — deriva todos os indicadores do dashboard a partir das queries
 * centrais do CRM (deals, prospects, clients, tasks, briefings, stages).
 * NÃO faz fetch. NÃO toca em rede. Memoizar no consumidor.
 */
export function deriveDashboardMetrics(input: Partial<DashboardInputs>): DashboardMetrics {
  const deals = input.deals ?? [];
  const prospects = input.prospects ?? [];
  const clients = input.clients ?? [];
  const tasks = input.tasks ?? [];
  const briefings = input.briefings ?? [];
  const stages = input.stages ?? [];

  const wonIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
  const lostIds = new Set(stages.filter((s) => s.is_lost).map((s) => s.id));

  let revenueWon = 0, pipelineValue = 0, dealsOpen = 0, dealsWon = 0, dealsLost = 0;
  let meetings = 0, proposals = 0;
  const dealProspectIds = new Set(deals.map((d) => d.prospect_id).filter(Boolean) as string[]);
  const dealByProspectId = new Map(deals.filter((d) => d.prospect_id).map((d) => [d.prospect_id as string, d]));
  const prospectById = new Map(prospects.map((p) => [p.id, p]));
  const prospectWonBonus = prospects.filter((p) => {
    if (p.responseStatus !== "cliente" && !CLIENT_PIPELINE_STATUSES.has(p.status)) return false;
    const deal = dealByProspectId.get(p.id);
    return !deal || !wonIds.has(deal.stage_id);
  }).length;
  const prospectProposalBonus = prospects.filter((p) => {
    if (!PROPOSAL_PIPELINE_STATUSES.has(p.status)) return false;
    const deal = dealByProspectId.get(p.id);
    return !deal || deal.stage_id !== "proposta";
  }).length;
  const prospectMeetingBonus = prospects.filter((p) => {
    if (!MEETING_PIPELINE_STATUSES.has(p.status)) return false;
    const deal = dealByProspectId.get(p.id);
    return !deal || (deal.stage_id !== "reuniao" && deal.stage_id !== "proposta" && !wonIds.has(deal.stage_id));
  }).length;
  for (const d of deals) {
    const v = Number(d.value || 0);
    const prospect = d.prospect_id ? prospectById.get(d.prospect_id) : undefined;
    const prospectWon = prospect ? prospect.responseStatus === "cliente" || CLIENT_PIPELINE_STATUSES.has(prospect.status) : false;
    if (wonIds.has(d.stage_id) || prospectWon) {
      dealsWon++;
      revenueWon += v;
    } else if (lostIds.has(d.stage_id)) {
      dealsLost++;
    } else {
      dealsOpen++;
      pipelineValue += v;
    }
    if (d.stage_id === "reuniao" || (prospect && MEETING_PIPELINE_STATUSES.has(prospect.status))) meetings++;
    if (d.stage_id === "proposta" || (prospect && PROPOSAL_PIPELINE_STATUSES.has(prospect.status))) proposals++;
  }
  dealsWon += prospectWonBonus;
  meetings += prospectMeetingBonus;
  proposals += prospectProposalBonus;

  const prospectsContacted = prospects.filter((p) => p.status !== "nao_contatado").length;
  let conversationsStarted = 0;
  for (const p of prospects) {
    for (const ix of p.interactions ?? []) {
      if (ix.kind === "whatsapp" || ix.kind === "ligacao" || ix.kind === "email") {
        conversationsStarted++;
      }
    }
  }

  const kpis: DashboardKPIs = {
    prospectsTotal: prospects.length,
    prospectsContacted,
    conversationsStarted,
    clientsTotal: clients.length,
    dealsOpen,
    dealsWon,
    dealsLost,
    revenueWon,
    pipelineValue,
    avgTicket: dealsWon ? revenueWon / dealsWon : 0,
    meetings,
    proposals,
    briefingsTotal: briefings.length,
    tasksTotal: tasks.length,
  };

  const funnel: FunnelStage[] = stages
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => {
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

  const totalDeals = kpis.dealsOpen + kpis.dealsWon + kpis.dealsLost;
  const conversion: ConversionMetrics = {
    prospectsToClients: kpis.prospectsTotal ? (kpis.clientsTotal / kpis.prospectsTotal) * 100 : 0,
    dealsToWon: totalDeals > 0 ? (kpis.dealsWon / totalDeals) * 100 : 0,
    meetingsToProposals: kpis.meetings ? (kpis.proposals / kpis.meetings) * 100 : 0,
  };

  return { kpis, funnel, conversion };
}

export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  kpis: EMPTY_KPIS,
  funnel: [],
  conversion: { prospectsToClients: 0, dealsToWon: 0, meetingsToProposals: 0 },
};