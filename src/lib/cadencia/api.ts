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

/** Mapeamento reverso: stage de cadência → status de prospect (CRM). */
const CAD_STAGE_TO_PROSPECT_STATUS: Record<CadStage, string> = {
  followup_1: "primeiro_contato",
  followup_2: "primeiro_contato",
  followup_3: "primeiro_contato",
  followup_4: "primeiro_contato",
  followup_5: "primeiro_contato",
  followup_6: "primeiro_contato",
  followup_7: "primeiro_contato",
  interessado: "qualificado",
  reuniao_agendada: "agendado",
  proposta_enviada: "proposta_enviada",
  negociacao: "em_negociacao",
  fechado: "fechado_ganho",
  perdido: "perdido",
};

function prospectStatusToCadStage(status: string | null | undefined): CadStage {
  if (status?.startsWith("aguardando_")) return "fechado";
  // Fallback seguro: estágio inicial de follow-up. `novo` foi removido da
  // máquina de estados (migration 20260719) e o enum cad_stage rejeita.
  return PROSPECT_STATUS_TO_CAD_STAGE[status ?? ""] ?? "followup_1";
}

/**
 * Propaga uma mudança de stage da cadência para o status do prospect (CRM),
 * mantendo Prospecção, CRM e Cadência sempre coerentes.
 * - Só atualiza se o status atual NÃO mapeia para o stage destino.
 * - Preserva "cliente" e variantes "aguardando_*"/"em_producao"/"entregue" quando
 *   o destino é `fechado` (não regride status pós-venda).
 */
async function propagateStageToProspect(leadId: string, stage: CadStage): Promise<void> {
  const { data: leadRow, error: leadErr } = await db
    .from("cad_leads").select("prospect_id").eq("id", leadId).maybeSingle();
  if (leadErr) return;
  const prospectId = (leadRow as { prospect_id: string | null } | null)?.prospect_id;
  if (!prospectId) return;

  const { data: pRow, error: pErr } = await db
    .from("prospects").select("status").eq("id", prospectId).maybeSingle();
  if (pErr) return;
  const current = (pRow as { status: string | null } | null)?.status ?? null;

  // Se o status atual já mapeia para o stage destino, não faz nada.
  if (current && prospectStatusToCadStage(current) === stage) return;

  // Preserva status pós-venda quando o destino é `fechado`.
  const postSale = new Set(["cliente", "aguardando_kickoff", "aguardando_producao", "em_producao", "entregue"]);
  if (stage === "fechado" && current && postSale.has(current)) return;

  const targetStatus = CAD_STAGE_TO_PROSPECT_STATUS[stage];
  if (!targetStatus) return;
  await db.from("prospects").update({ status: targetStatus }).eq("id", prospectId);
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
      // Ordem canônica da fila: vencidos/no prazo primeiro (asc),
      // futuros depois, sem data por último. Mesma regra do Kanban.
      .order("next_action_at", { ascending: true, nullsFirst: false })
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
  // Pré-check: evita estourar a unique constraint `ux_cad_leads_org_whatsapp_norm`.
  // Se já existir um lead na mesma org com o mesmo WhatsApp (normalizado),
  // devolvemos uma mensagem amigável apontando o card existente em vez de
  // tentar o INSERT.
  const preDigits = (input.whatsapp || input.telefone || "").replace(/\D/g, "");
  if (preDigits.length >= 8) {
    const existing = await findLeadByWhatsappDigits(preDigits);
    if (existing) {
      throw new Error(
        `Este WhatsApp já está na cadência (já cadastrado como "${existing.empresa}"). Abra o card existente em vez de criar outro.`,
      );
    }
  }
  const { data, error } = await db.from("cad_leads").insert(input).select("*").single();
  if (error) {
    const msg = String(error.message || "");
    // 23505 unique_violation — geralmente ux_cad_leads_org_whatsapp_norm (mesmo
    // WhatsApp já cadastrado na cadência). Tenta recuperar o lead existente
    // para o usuário e devolve mensagem amigável.
    if (/duplicate key|unique constraint|ux_cad_leads_/i.test(msg)) {
      const digits = (input.whatsapp || input.telefone || "").replace(/\D/g, "");
      const existing = digits ? await findLeadByWhatsappDigits(digits) : null;
      const label = existing?.empresa ? ` (já cadastrado como "${existing.empresa}")` : "";
      throw new Error(`Este WhatsApp já está na cadência${label}. Abra o card existente em vez de criar outro.`);
    }
    throw new Error(msg);
  }
  return data as CadLead;
}

/**
 * Procura um lead na cadência pelos dígitos normalizados do WhatsApp/telefone.
 * A unique constraint do banco normaliza removendo não-dígitos, então usamos
 * `ilike %digits%` em ambos os campos para cobrir variações de formatação.
 */
export async function findLeadByWhatsappDigits(digits: string): Promise<CadLead | null> {
  const d = (digits || "").replace(/\D/g, "");
  if (d.length < 8) return null;
  // A unique constraint do banco normaliza removendo não-dígitos. O `ilike` no
  // PostgREST não consegue replicar isso (ex.: whatsapp "(11) 99999-9999" não
  // contém a substring "11999999999"), então paginamos os leads e comparamos
  // pelos dígitos em memória. O volume típico (<2k) torna isso barato.
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("cad_leads")
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CadLead[];
    const hit = rows.find((l) => {
      const w = (l.whatsapp || "").replace(/\D/g, "");
      const t = (l.telefone || "").replace(/\D/g, "");
      // match pelos últimos 10 dígitos cobre variações com/sem DDI (55).
      const tail = d.slice(-10);
      return (w && w.endsWith(tail)) || (t && t.endsWith(tail));
    });
    if (hit) return hit;
    if (rows.length < pageSize) return null;
  }
}

/**
 * Retorna leads da cadência que NÃO possuem WhatsApp utilizável (campo vazio
 * ou sem dígitos suficientes em `whatsapp`/`telefone`). Útil para exportação
 * e tratamento manual.
 */
export async function listLeadsSemWhatsapp(): Promise<CadLead[]> {
  const all = await listLeads();
  return all.filter((l) => {
    const w = (l.whatsapp || "").replace(/\D/g, "");
    const t = (l.telefone || "").replace(/\D/g, "");
    return w.length < 10 && t.length < 10;
  });
}

export async function updateLead(id: string, patch: Partial<CadLead>): Promise<CadLead> {
  // GUARD: `stage` é máquina de estados — só pode mudar via cad_register_send
  // (após envio confirmado) ou cad_move_stage (alteração manual explícita).
  if (Object.prototype.hasOwnProperty.call(patch, "stage")) {
    throw new Error(
      "updateLead: alteração de `stage` proibida. Use moveStage() (cad_move_stage) ou registerSend() (cad_register_send).",
    );
  }
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
  // Sincroniza CRM/Prospecção automaticamente.
  try {
    await propagateStageToProspect(leadId, stage);
  } catch (e) {
    console.warn("Falha ao propagar stage para prospect:", e);
  }
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
  const base = (data ?? {}) as Partial<CadMetrics>;
  // Fonte confiável do gráfico: sempre recalcula por dia direto de cad_messages,
  // porque o RPC pode devolver serie_30d presente porém zerada/desatualizada.
  const serie = await fetchSerie30d();
  return {
    total: base.total ?? 0,
    by_stage: base.by_stage ?? {},
    taxa_resposta: base.taxa_resposta ?? 0,
    taxa_conversao: base.taxa_conversao ?? 0,
    total_mensagens: base.total_mensagens ?? 0,
    serie_30d: serie,
  };
}

async function fetchSerie30d(): Promise<CadMetrics["serie_30d"]> {
  // Agregação no servidor via RPC (substitui full-scan paginado).
  // Fallback gracioso se a migration ainda não rodou.
  const { data, error } = await db.rpc("cad_metrics_serie_30d");
  if (error) {
    console.warn("[cadencia] cad_metrics_serie_30d", error.message);
    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);
    return buildEmptySerie(since);
  }
  const rows = (data ?? []) as Array<{ dia: string; enviadas: number | string; respostas: number | string }>;
  return rows.map((r) => ({
    dia: formatIsoDate(r.dia),
    enviadas: Number(r.enviadas) || 0,
    respostas: Number(r.respostas) || 0,
  }));
}

function formatIsoDate(iso: string): string {
  // 'YYYY-MM-DD' -> 'DD/MM'
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}

function dayKey(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function buildEmptySerie(since: Date): CadMetrics["serie_30d"] {
  const out: CadMetrics["serie_30d"] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    out.push({ dia: dayKey(d), enviadas: 0, respostas: 0 });
  }
  return out;
}

export async function syncLeadStagesFromProspects(): Promise<number> {
  // Apenas reflete RESULTADOS do CRM (interessado/agendado/proposta/negociacao/
  // fechado/perdido) em cad_leads. NUNCA toca em stages de cadência ativa
  // (`novo`, `followup_*`) — esses só mudam via cad_register_send/cad_move_stage.
  const OUTCOME_STAGES = new Set<CadStage>([
    "interessado",
    "reuniao_agendada",
    "proposta_enviada",
    "negociacao",
    "fechado",
    "perdido",
  ]);
  const ACTIVE_STAGES = new Set<CadStage>([
    "followup_1","followup_2","followup_3","followup_4","followup_5","followup_6","followup_7",
  ]);
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
    // Nunca regride/avança a cadência ativa a partir do CRM.
    if (!OUTCOME_STAGES.has(targetStage)) continue;
    // Nunca sobrescreve um lead que já está em outcome com outro outcome
    // automaticamente quando o lead ainda está em fase de follow-up ativo
    // pendente de envio — apenas migra leads de novo/followup_* → outcome.
    if (!ACTIVE_STAGES.has(lead.stage) && !OUTCOME_STAGES.has(lead.stage)) continue;
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
      .select("id,status,whatsapp,phone")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as (ProspectStatusRow & { whatsapp?: string | null; phone?: string | null })[];
    for (const r of rows) {
      if (!r.status || r.status === "nao_contatado") naoContatadoIds.push(r.id);
      else eligibleIds.push(r.id);
      // guarda dígitos para dedupe abaixo
      (eligibleIds as any).__digits = (eligibleIds as any).__digits || new Map<string, string>();
      const digits = ((r.whatsapp || r.phone || "") as string).replace(/\D/g, "");
      if (digits.length >= 8) (eligibleIds as any).__digits.set(r.id, digits);
    }
    if (rows.length < pageSize) break;
  }

  // Dedupe: remove prospects cujo WhatsApp já existe em cad_leads (mesma org),
  // evitando estourar a unique constraint `ux_cad_leads_org_whatsapp_norm`
  // dentro da RPC `cad_import_from_prospects`.
  const digitsMap: Map<string, string> = (eligibleIds as any).__digits ?? new Map();
  let skippedDup = 0;
  if (digitsMap.size > 0) {
    const existingDigits = new Set<string>();
    const pageSz = 1000;
    for (let from = 0; ; from += pageSz) {
      const { data, error } = await db
        .from("cad_leads")
        .select("whatsapp,telefone")
        .range(from, from + pageSz - 1);
      if (error) break;
      const rows = (data ?? []) as { whatsapp: string | null; telefone: string | null }[];
      for (const r of rows) {
        const d1 = (r.whatsapp || "").replace(/\D/g, "");
        const d2 = (r.telefone || "").replace(/\D/g, "");
        if (d1.length >= 8) existingDigits.add(d1);
        if (d2.length >= 8) existingDigits.add(d2);
      }
      if (rows.length < pageSz) break;
    }
    const filtered: string[] = [];
    for (const id of eligibleIds) {
      const d = digitsMap.get(id);
      if (d && existingDigits.has(d)) { skippedDup++; continue; }
      filtered.push(id);
    }
    eligibleIds.length = 0;
    eligibleIds.push(...filtered);
  }

  let imported = 0;
  for (const batch of chunk(eligibleIds, 500)) {
    const { data, error } = await db.rpc("cad_import_from_prospects", { p_ids: batch });
    if (error) {
      const msg = String(error.message || "");
      // Ignora duplicatas residuais (corrida entre clientes); reporta o resto.
      if (!/duplicate key|unique constraint|ux_cad_leads_/i.test(msg)) {
        throw new Error(msg);
      }
      skippedDup += batch.length;
      continue;
    }
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
  return { imported, updated, skipped: naoContatadoIds.length + skippedDup, cleaned };
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