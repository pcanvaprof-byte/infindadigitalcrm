import { supabase } from "@/integrations/supabase/client";
import type { CadLead, CadMessage, CadMetrics, CadStage, CadTemp, CadTemplate, CadMsgTipo } from "./types";

// Cast helpers — tables não geradas ainda em Database types
const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (n: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type ProspectStatusRow = { id: string; status: string | null };
type CadLeadStageRow = Pick<CadLead, "id" | "prospect_id" | "stage">;

const PROSPECT_STATUS_TO_CAD_STAGE: Record<string, CadStage> = {
  primeiro_contato: "followup_2",
  qualificado: "interessado",
  briefing_enviado: "interessado",
  diagnostico_pendente: "interessado",
  agendado: "reuniao_agendada",
  proposta_enviada: "proposta_enviada",
  proposta_pendente: "negociacao",
  em_negociacao: "negociacao",
  fechado_ganho: "fechado",
  cliente: "fechado",
  aguardando_kickoff: "fechado",
  aguardando_producao: "fechado",
  em_producao: "fechado",
  entregue: "fechado",
  perdido: "perdido",
};

function prospectStatusToCadStage(status: string | null | undefined): CadStage {
  if (status?.startsWith("aguardando_")) return "fechado";
  return PROSPECT_STATUS_TO_CAD_STAGE[status ?? ""] ?? "followup_1";
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function listLeads(): Promise<CadLead[]> {
  const pageSize = 1000;
  const all: CadLead[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("cad_leads")
      .select("*")
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CadLead[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export async function getLead(id: string): Promise<CadLead | null> {
  const { data, error } = await db.from("cad_leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as CadLead | null;
}

export async function createLead(input: Partial<CadLead> & { empresa: string }): Promise<CadLead> {
  const { data, error } = await db.from("cad_leads").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as CadLead;
}

export async function updateLead(id: string, patch: Partial<CadLead>): Promise<CadLead> {
  const { data, error } = await db.from("cad_leads").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as CadLead;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await db.from("cad_leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function moveStage(leadId: string, stage: CadStage): Promise<void> {
  const { error } = await db.rpc("cad_move_stage", { p_lead: leadId, p_stage: stage });
  if (error) throw new Error(error.message);
}

export async function setTemperatura(id: string, temp: CadTemp): Promise<void> {
  await updateLead(id, { temperatura: temp });
}

export async function listMessages(leadId: string): Promise<CadMessage[]> {
  const { data, error } = await db.from("cad_messages")
    .select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CadMessage[];
}

export async function registerSend(params: {
  leadId: string;
  tipo: CadMsgTipo;
  mensagem: string;
  advance?: boolean;
}): Promise<string> {
  const { data, error } = await db.rpc("cad_register_send", {
    p_lead: params.leadId,
    p_tipo: params.tipo,
    p_mensagem: params.mensagem,
    p_advance: params.advance ?? true,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Após um disparo via cadência, promove o prospect vinculado de
 * `nao_contatado` (ou sem status) para `primeiro_contato`, removendo-o
 * da lista de não contatados em Prospecção.
 * Não regride status mais avançados (qualificado, agendado, etc.).
 */
export async function markProspectContactedFromLead(leadId: string): Promise<boolean> {
  const { data: leadRow, error: leadErr } = await db
    .from("cad_leads")
    .select("prospect_id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  const prospectId = (leadRow as { prospect_id: string | null } | null)?.prospect_id;
  if (!prospectId) return false;

  const { data: prospectRow, error: pErr } = await db
    .from("prospects")
    .select("status")
    .eq("id", prospectId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  const status = (prospectRow as { status: string | null } | null)?.status ?? null;
  if (status && status !== "nao_contatado") return false;

  const { error: updErr } = await db
    .from("prospects")
    .update({ status: "primeiro_contato" })
    .eq("id", prospectId);
  if (updErr) throw new Error(updErr.message);
  return true;
}

export async function registerResponse(leadId: string, mensagem: string): Promise<void> {
  const { error } = await db.rpc("cad_register_response", { p_lead: leadId, p_mensagem: mensagem });
  if (error) throw new Error(error.message);
}

export async function listTemplates(): Promise<CadTemplate[]> {
  const { data, error } = await db.from("cad_templates").select("*").order("stage");
  if (error) throw new Error(error.message);
  return (data ?? []) as CadTemplate[];
}

export async function upsertTemplate(input: { stage: CadStage; titulo: string; corpo: string }): Promise<void> {
  // Buscar org via RPC current_org_id
  const { data: orgData, error: orgErr } = await db.rpc("current_org_id");
  if (orgErr) throw new Error(orgErr.message);
  const organization_id = orgData as string;
  const { error } = await db.from("cad_templates")
    .upsert({ organization_id, ...input }, { onConflict: "organization_id,stage" });
  if (error) throw new Error(error.message);
}

export async function fetchMetrics(): Promise<CadMetrics> {
  const { data, error } = await db.rpc("cad_dashboard_metrics");
  if (error) throw new Error(error.message);
  return data as CadMetrics;
}

export async function syncLeadStagesFromProspects(): Promise<number> {
  const pageSize = 1000;
  const prospects: ProspectStatusRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("prospects")
      .select("id,status")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ProspectStatusRow[];
    prospects.push(...rows);
    if (rows.length < pageSize) break;
  }

  const statusByProspectId = new Map(prospects.map((p) => [p.id, p.status]));
  if (statusByProspectId.size === 0) return 0;

  const leads: CadLeadStageRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("cad_leads")
      .select("id,prospect_id,stage")
      .not("prospect_id", "is", null)
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CadLeadStageRow[];
    leads.push(...rows);
    if (rows.length < pageSize) break;
  }

  const idsByStage = new Map<CadStage, string[]>();
  for (const lead of leads) {
    if (!lead.prospect_id) continue;
    if (!statusByProspectId.has(lead.prospect_id)) continue;
    const targetStage = prospectStatusToCadStage(statusByProspectId.get(lead.prospect_id));
    if (targetStage === lead.stage) continue;
    idsByStage.set(targetStage, [...(idsByStage.get(targetStage) ?? []), lead.id]);
  }

  let updated = 0;
  for (const [stage, ids] of idsByStage) {
    for (const batch of chunk(ids, 200)) {
      const { error } = await db.from("cad_leads").update({ stage }).in("id", batch);
      if (error) throw new Error(error.message);
      updated += batch.length;
    }
  }
  return updated;
}

/**
 * Cadência só recebe leads que JÁ tiveram disparo/contato.
 * Prospects com status `nao_contatado` (ou sem status) permanecem em Prospecção
 * para serem selecionados no momento do disparo.
 */
export async function importFromProspects(): Promise<{ imported: number; updated: number; skipped: number; cleaned: number }> {
  const pageSize = 1000;
  const eligibleIds: string[] = [];
  const naoContatadoIds: string[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("prospects")
      .select("id,status")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ProspectStatusRow[];
    for (const r of rows) {
      if (!r.status || r.status === "nao_contatado") naoContatadoIds.push(r.id);
      else eligibleIds.push(r.id);
    }
    if (rows.length < pageSize) break;
  }

  let imported = 0;
  for (const batch of chunk(eligibleIds, 500)) {
    const { data, error } = await db.rpc("cad_import_from_prospects", { p_ids: batch });
    if (error) throw new Error(error.message);
    imported += (data as number) ?? 0;
  }

  // Limpa cards que entraram antes dessa regra: remove leads vinculados a prospects
  // ainda `nao_contatado` e SEM nenhum disparo registrado (preserva histórico real).
  let cleaned = 0;
  for (const batch of chunk(naoContatadoIds, 200)) {
    const { data, error } = await db
      .from("cad_leads")
      .delete()
      .in("prospect_id", batch)
      .is("last_contact_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    cleaned += ((data ?? []) as { id: string }[]).length;
  }

  const updated = await syncLeadStagesFromProspects();
  return { imported, updated, skipped: naoContatadoIds.length, cleaned };
}

// ----- Notificações -----
export type CadNotifKind = "overdue" | "last_attempt" | "response_pending";

export type CadNotification = {
  id: string;
  lead_id: string;
  kind: CadNotifKind;
  payload: Record<string, unknown>;
  created_at: string;
  handled_at: string | null;
  empresa: string;
  responsavel: string | null;
  telefone: string | null;
  whatsapp: string | null;
  stage: string;
  next_action_at: string | null;
  last_response_at: string | null;
  temperatura: string;
};

export async function refreshNotifications(): Promise<number> {
  const { data, error } = await db.rpc("cad_refresh_notifications");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function listNotifications(): Promise<CadNotification[]> {
  const { data, error } = await db
    .from("cad_notifications_v")
    .select("*")
    .is("handled_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CadNotification[];
}

export async function markNotificationHandled(id: string): Promise<void> {
  const { error } = await db.rpc("cad_mark_notification_handled", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsHandled(): Promise<number> {
  const { data, error } = await db.rpc("cad_mark_all_notifications_handled");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}