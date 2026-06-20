/**
 * Event Boundary Document (EBD) — eventos de negócio.
 * Toda string aqui é prefixada com `evt_` e consumida por BI / dashboards / IA.
 * NÃO inclua eventos de auditoria estrutural (`aud_*`).
 */
export const PROPOSAL_EVENT_TYPES = [
  "evt_proposal_created",
  "evt_proposal_sent",
  "evt_proposal_viewed",
  "evt_proposal_downloaded",
  "evt_proposal_approved",
  "evt_proposal_rejected",
  "evt_proposal_expired",
  "evt_adjustments_requested",
  "evt_item_accepted",
  "evt_item_rejected",
  "evt_discount_applied",
  "evt_version_created",
  "evt_briefing_created",
  "evt_briefing_completed",
  "evt_kickoff_created",
  "evt_contract_signed",
] as const;

export type ProposalEventType = (typeof PROPOSAL_EVENT_TYPES)[number];

export type ProposalEventActor = "system" | "client" | "user";

export interface LogEventInput {
  proposalId: string;
  type: ProposalEventType;
  payload?: Record<string, unknown>;
  actor?: ProposalEventActor;
}