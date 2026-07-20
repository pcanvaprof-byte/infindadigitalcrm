import { supabase } from "@/integrations/supabase/client";
import { CAD_STAGES, type CadLead, type CadMessage, type CadMetrics, type CadStage, type CadTemp, type CadTemplate, type CadMsgTipo } from "./types";

// Cast helpers — tables não geradas ainda em Database types
const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (n: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type ProspectStatusRow = { id: string; status: string | null };
type CadLeadStageRow = Pick<CadLead, "id" | "prospect_id" | "stage">;
type CadContext = { uid: string | null; role: string | null; orgId: string | null };
type CadMessageMetricRow = { lead_id: string; direction: string; created_at: string };
type ImportProspectRow = ProspectStatusRow & {
  organization_id?: string | null;
  company?: string | null;
  owner_name?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  created_at?: string | null;
};

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
 * Arquitetura híbrida: NUNCA grava em `prospects` (compartilhado).
 * A projeção do stage vira `status` privado no histórico de touchpoints do
 * dono da cadência (`cad_leads.owner_id`).
 */
async function propagateStageToProspect(leadId: string, stage: CadStage): Promise<void> {
  const { data: leadRow, error: leadErr } = await db
    .from("cad_leads")
    .select("prospect_id, owner_id, organization_id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) return;
  const row = leadRow as {
    prospect_id: string | null;
    owner_id: string | null;
    organization_id: string | null;
  } | null;
  const prospectId = row?.prospect_id;
  const ownerId = row?.owner_id;
  if (!prospectId || !ownerId) return;

  // Lê o estado privado ATUAL do dono da cadência (não o compartilhado).
  const current = await getPrivateProspectStatus(prospectId, ownerId);

  if (current && prospectStatusToCadStage(current) === stage) return;

  // Preserva status pós-venda quando o destino é `fechado` (privado).
  const postSale = new Set(["cliente", "aguardando_kickoff", "aguardando_producao", "em_producao", "entregue"]);
  if (stage === "fechado" && current && postSale.has(current)) return;

  const targetStatus = CAD_STAGE_TO_PROSPECT_STATUS[stage];
  if (!targetStatus) return;

  await savePrivateProspectStatus(prospectId, ownerId, targetStatus);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function getCadContext(): Promise<CadContext> {
  const safeRpc = <T = unknown>(fn: string) =>
    Promise.resolve(db.rpc(fn)).then(
      (r) => r as { data: T | null; error: unknown },
      () => ({ data: null as T | null, error: null }),
    );
  const [{ data: userRes }, roleRes, orgRes] = await Promise.all([
    supabase.auth.getUser(),
    safeRpc<string>("current_org_role"),
    safeRpc<string>("current_org_id"),
  ]);
  return {
    uid: userRes.user?.id ?? null,
    role: typeof roleRes.data === "string" ? roleRes.data : null,
    orgId: typeof orgRes.data === "string" ? orgRes.data : null,
  };
}

function isMemberContext(ctx: CadContext): boolean {
  return ctx.role !== "owner" && ctx.role !== "admin";
}

function normalizeProspectStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  const status = value.trim().replace(/^status\s*:\s*/i, "");
  return Object.prototype.hasOwnProperty.call(PROSPECT_STATUS_TO_CAD_STAGE, status) || status === "nao_contatado"
    ? status
    : null;
}

async function getPrivateProspectStatus(prospectId: string, userId: string): Promise<string | null> {
  const { data, error } = await db
    .from("prospect_touchpoints")
    .select("tipo,resultado,mensagem,enviado_em")
    .eq("prospect_id", prospectId)
    .eq("user_id", userId)
    .in("tipo", ["status", "whatsapp", "ligacao", "email", "reuniao", "resposta"])
    .order("enviado_em", { ascending: false })
    .limit(50);
  if (error) return null;
  for (const row of (data ?? []) as Array<{ tipo: string | null; resultado: string | null; mensagem: string | null }>) {
    if (row.tipo === "status") {
      const status = normalizeProspectStatus(row.resultado) ?? normalizeProspectStatus(row.mensagem);
      if (status) return status;
    }
    if (row.tipo === "resposta" || row.resultado === "respondido" || row.resultado === "interessado") return "qualificado";
    if (["whatsapp", "ligacao", "email", "reuniao"].includes(row.tipo ?? "")) return "primeiro_contato";
  }
  return null;
}

async function savePrivateProspectStatus(prospectId: string, userId: string, status: string): Promise<void> {
  const { error } = await db.from("prospect_touchpoints").insert({
    prospect_id: prospectId,
    user_id: userId,
    tipo: "status",
    resultado: status,
    mensagem: `status:${status}`,
    by_name: "Sistema",
    enviado_em: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function listLeads(): Promise<CadLead[]> {
  const ctx = await getCadContext();
  if (isMemberContext(ctx) && !ctx.uid) return [];
  const pageSize = 1000;
  const all: CadLead[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = db
      .from("cad_leads")
      .select("*")
      // Defesa no cliente: Member nunca carrega cards de outros usuários,
      // mesmo se alguma policy/RPC antiga ainda estiver permissiva no banco.
    if (isMemberContext(ctx)) query = query.eq("owner_id", ctx.uid);
    const { data, error } = await query
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
    .select("prospect_id, owner_id, organization_id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  const row = leadRow as {
    prospect_id: string | null;
    owner_id: string | null;
    organization_id: string | null;
  } | null;
  const prospectId = row?.prospect_id;
  const ownerId = row?.owner_id;
  if (!prospectId || !ownerId) return false;

  // Só olha o estado privado do dono; NUNCA mexe em prospects.
  const status = await getPrivateProspectStatus(prospectId, ownerId);
  if (status && status !== "nao_contatado") return false;

  await savePrivateProspectStatus(prospectId, ownerId, "primeiro_contato");
  return true;
}

export async function registerResponse(leadId: string, mensagem: string): Promise<void> {
  const { error } = await db.rpc("cad_register_response", { p_lead: leadId, p_mensagem: mensagem });
  if (error) throw new Error(error.message);
}

export async function listTemplates(): Promise<CadTemplate[]> {
  // Padrão da organização apenas (owner_id IS NULL). Overrides de member
  // são resolvidos pela RPC cad_resolve_template — nunca consumidos daqui.
  const { data, error } = await db.from("cad_templates")
    .select("*")
    .is("owner_id", null)
    .order("stage");
  if (error) throw new Error(error.message);
  return (data ?? []) as CadTemplate[];
}

export async function upsertTemplate(input: { stage: CadStage; titulo: string; corpo: string }): Promise<void> {
  // Editor do padrão da organização (owner/admin). owner_id fica NULL.
  const { data: orgData, error: orgErr } = await db.rpc("current_org_id");
  if (orgErr) throw new Error(orgErr.message);
  const organization_id = orgData as string;
  const { error } = await db.from("cad_templates")
    .upsert(
      { organization_id, owner_id: null, pack_key: "default", ...input },
      { onConflict: "organization_id,owner_id,pack_key,stage" },
    );
  if (error) throw new Error(error.message);
}

// ============================================================
// Resolução via RPC (fonte única para o motor de disparo)
// ============================================================

export type ResolvedTemplate = {
  stage: CadStage;
  titulo: string;
  corpo: string;
  source: "user" | "org" | "system";
};

type TemplateResolutionRow = {
  id: string;
  stage: CadStage;
  titulo: string;
  corpo: string;
  pack_key: string | null;
  organization_id: string | null;
  owner_id: string | null;
  is_system: boolean | null;
};

async function getMyContext(): Promise<{ orgId: string; ownerId: string; packKey: string }> {
  const { data: userRes } = await supabase.auth.getUser();
  const ownerId = userRes.user?.id;
  if (!ownerId) throw new Error("auth_required");

  const { data: orgData, error: orgErr } = await db.rpc("current_org_id");
  if (orgErr) throw new Error(orgErr.message);
  const orgId = orgData as string;
  if (!orgId) throw new Error("no_active_org");

  // Pack ativo da organização (fallback default).
  const { data: orgRow } = await db.from("organizations")
    .select("active_template_pack")
    .eq("id", orgId)
    .maybeSingle();
  const packKey = (orgRow?.active_template_pack as string | null) || "default";

  return { orgId, ownerId, packKey };
}

function templateSource(row: TemplateResolutionRow, orgId: string, ownerId: string): ResolvedTemplate["source"] | null {
  if (row.organization_id === orgId && row.owner_id === ownerId) return "user";
  if (row.organization_id === orgId && !row.owner_id) return "org";
  if (row.is_system) return "system";
  return null;
}

function templatePriority(row: TemplateResolutionRow, orgId: string, ownerId: string, packKey: string): number {
  const packRank = row.pack_key === packKey ? 0 : row.pack_key === "default" ? 10 : 20;
  const source = templateSource(row, orgId, ownerId);
  const sourceRank = source === "user" ? 0 : source === "org" ? 1 : source === "system" ? 2 : 9;
  return packRank + sourceRank;
}

async function fetchResolvedTemplatesDirect(stages: CadStage[]): Promise<Array<ResolvedTemplate & { override_id: string | null }>> {
  const { orgId, ownerId, packKey } = await getMyContext();
  const packKeys = packKey === "default" ? ["default"] : [packKey, "default"];

  const { data, error } = await db
    .from("cad_templates")
    .select("id,stage,titulo,corpo,pack_key,organization_id,owner_id,is_system")
    .in("pack_key", packKeys)
    .in("stage", stages);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as TemplateResolutionRow[];
  return stages.flatMap((stage) => {
    const candidates = rows
      .filter((row) => row.stage === stage && templateSource(row, orgId, ownerId))
      .sort((a, b) => templatePriority(a, orgId, ownerId, packKey) - templatePriority(b, orgId, ownerId, packKey));
    const row = candidates[0];
    const source = row ? templateSource(row, orgId, ownerId) : null;
    if (!row || !source) return [];

    const ownOverride = rows.find(
      (item) => item.stage === stage && item.pack_key === packKey && item.organization_id === orgId && item.owner_id === ownerId,
    );
    return [{ stage, titulo: row.titulo, corpo: row.corpo, source, override_id: ownOverride?.id ?? null }];
  });
}

/** Resolve UM template via RPC (motor de disparo). */
export async function resolveTemplate(stage: CadStage): Promise<ResolvedTemplate | null> {
  const [row] = await fetchResolvedTemplatesDirect([stage]);
  return row ? { stage: row.stage, titulo: row.titulo, corpo: row.corpo, source: row.source } : null;
}

/** Resolve TODOS os 7 followups via RPC (para Kanban / listagem). */
export async function listResolvedTemplates(): Promise<ResolvedTemplate[]> {
  return (await fetchResolvedTemplatesDirect([...CAD_STAGES])).map(({ override_id: _overrideId, ...row }) => row);
}

// ============================================================
// Overrides do member: CRUD
// ============================================================

export type MyTemplateRow = {
  stage: CadStage;
  titulo: string;
  corpo: string;
  source: "user" | "org" | "system";
  override_id: string | null;
};

/** Lista os 7 followups já resolvidos + marca se há override do usuário. */
export async function listMyTemplates(): Promise<MyTemplateRow[]> {
  return (await fetchResolvedTemplatesDirect([...CAD_STAGES])).map((r) => ({
    stage: r.stage,
    titulo: r.titulo,
    corpo: r.corpo,
    source: r.source,
    override_id: r.override_id ?? null,
  }));
}

/** Cria/atualiza override do member (owner_id = auth.uid()). */
export async function upsertMyTemplate(input: {
  stage: CadStage;
  titulo: string;
  corpo: string;
}): Promise<void> {
  const { orgId, ownerId, packKey } = await getMyContext();
  const { data: existing, error: findError } = await db
    .from("cad_templates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("owner_id", ownerId)
    .eq("pack_key", packKey)
    .eq("stage", input.stage)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  if ((existing as { id?: string } | null)?.id) {
    const { error } = await db
      .from("cad_templates")
      .update({ titulo: input.titulo, corpo: input.corpo, is_system: false })
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await db.from("cad_templates").insert({
    organization_id: orgId,
    owner_id: ownerId,
    pack_key: packKey,
    is_system: false,
    stage: input.stage,
    titulo: input.titulo,
    corpo: input.corpo,
  });
  if (error) throw new Error(error.message);
}

/** Restaura padrão da organização — apenas apaga o override do usuário. */
export async function resetMyTemplate(stage: CadStage): Promise<void> {
  const { orgId, ownerId, packKey } = await getMyContext();
  const { error } = await db.from("cad_templates")
    .delete()
    .eq("organization_id", orgId)
    .eq("owner_id", ownerId)
    .eq("pack_key", packKey)
    .eq("stage", stage);
  if (error) throw new Error(error.message);
}

export async function fetchMetrics(): Promise<CadMetrics> {
  const ctx = await getCadContext();
  if (isMemberContext(ctx)) {
    if (!ctx.uid) return emptyMetrics();
    return fetchMemberMetrics();
  }

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

async function fetchMemberMetrics(): Promise<CadMetrics> {
  const leads = await listLeads();
  const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);
  const by_stage: Partial<Record<CadStage, number>> = {};
  for (const lead of leads) by_stage[lead.stage] = (by_stage[lead.stage] ?? 0) + 1;

  const messages: CadMessageMetricRow[] = [];
  const leadIds = leads.map((lead) => lead.id);
  for (const batch of chunk(leadIds, 200)) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("cad_messages")
        .select("lead_id,direction,created_at")
        .in("lead_id", batch)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as CadMessageMetricRow[];
      messages.push(...rows);
      if (rows.length < 1000) break;
    }
  }

  const total = leads.length;
  const total_mensagens = messages.filter((m) => m.direction === "out").length;
  const total_resp = new Set(messages.filter((m) => m.direction === "in").map((m) => m.lead_id)).size;
  const total_fech = leads.filter((lead) => lead.stage === "fechado").length;
  const serie_30d = buildEmptySerie(since);
  const indexByDia = new Map(serie_30d.map((row) => [row.dia, row]));
  for (const msg of messages) {
    const bucket = indexByDia.get(dayKey(new Date(msg.created_at)));
    if (!bucket) continue;
    if (msg.direction === "in") bucket.respostas += 1;
    else bucket.enviadas += 1;
  }

  return {
    total,
    by_stage,
    taxa_resposta: total > 0 ? Math.round((total_resp * 1000) / total) / 10 : 0,
    taxa_conversao: total > 0 ? Math.round((total_fech * 1000) / total) / 10 : 0,
    total_mensagens,
    serie_30d,
  };
}

function emptyMetrics(): CadMetrics {
  const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);
  return {
    total: 0,
    by_stage: {},
    taxa_resposta: 0,
    taxa_conversao: 0,
    total_mensagens: 0,
    serie_30d: buildEmptySerie(since),
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
  const ctx = await getCadContext();
  if (!ctx.uid) throw new Error("Sessão expirada — entre novamente.");
  if (!ctx.orgId) throw new Error("Organização ativa não encontrada — recarregue e tente novamente.");
  const memberScoped = isMemberContext(ctx);
  const pageSize = 1000;
  const prospectRows: ImportProspectRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("prospects")
      .select("id,organization_id,status,company,owner_name,whatsapp,phone,created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ImportProspectRow[];
    prospectRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  const prospectIds = prospectRows.map((r) => r.id);
  const privateStatusByProspect = new Map<string, string>();
  const ownContactedProspects = new Set<string>();
  const lastContactByProspect = new Map<string, string>();

  for (const batch of chunk(prospectIds, 200)) {
    const { data: touchRows, error: touchError } = await db
      .from("prospect_touchpoints")
      .select("prospect_id,tipo,resultado,mensagem,enviado_em")
      .eq("user_id", ctx.uid)
      .in("prospect_id", batch)
      .in("tipo", ["whatsapp", "ligacao", "email", "reuniao", "resposta", "status"]);
    if (touchError) throw new Error(touchError.message);
    for (const row of (touchRows ?? []) as Array<{ prospect_id: string; tipo?: string | null; resultado?: string | null; mensagem?: string | null; enviado_em?: string | null }>) {
      if (row.tipo === "status") {
        const status = normalizeProspectStatus(row.resultado) ?? normalizeProspectStatus(row.mensagem);
        if (status && !privateStatusByProspect.has(row.prospect_id)) privateStatusByProspect.set(row.prospect_id, status);
      } else {
        ownContactedProspects.add(row.prospect_id);
        if (row.tipo === "resposta" || row.resultado === "respondido" || row.resultado === "interessado") {
          privateStatusByProspect.set(row.prospect_id, "qualificado");
        } else if (!privateStatusByProspect.has(row.prospect_id)) {
          privateStatusByProspect.set(row.prospect_id, "primeiro_contato");
        }
      }
      if (row.enviado_em) {
        const prev = lastContactByProspect.get(row.prospect_id);
        if (!prev || new Date(row.enviado_em).getTime() > new Date(prev).getTime()) {
          lastContactByProspect.set(row.prospect_id, row.enviado_em);
        }
      }
    }

    const { data: interactionRows, error: interactionError } = await db
      .from("prospect_interactions")
      .select("prospect_id,created_at")
      .eq("user_id", ctx.uid)
      .in("prospect_id", batch)
      .in("kind", ["whatsapp", "ligacao", "email"]);
    if (interactionError) throw new Error(interactionError.message);
    for (const row of (interactionRows ?? []) as Array<{ prospect_id: string; created_at?: string | null }>) {
      ownContactedProspects.add(row.prospect_id);
      if (row.created_at) {
        const prev = lastContactByProspect.get(row.prospect_id);
        if (!prev || new Date(row.created_at).getTime() > new Date(prev).getTime()) {
          lastContactByProspect.set(row.prospect_id, row.created_at);
        }
      }
    }
  }

  const eligibleIds: string[] = [];
  const naoContatadoIds: string[] = [];
  const digitsMap = new Map<string, string>();
  for (const row of prospectRows) {
    const privateStatus = privateStatusByProspect.get(row.id) ?? null;
    const effectiveStatus = memberScoped ? privateStatus : privateStatus ?? row.status;
    const hasContactSignal =
      ownContactedProspects.has(row.id) || Boolean(effectiveStatus && effectiveStatus !== "nao_contatado");

    if (hasContactSignal) eligibleIds.push(row.id);
    else naoContatadoIds.push(row.id);

    const digits = ((row.whatsapp || row.phone || "") as string).replace(/\D/g, "");
    if (digits.length >= 8) digitsMap.set(row.id, digits);
  }

  // Dedupe por usuário: Member deve poder importar para a SUA cadência privada
  // mesmo que outro usuário já tenha o mesmo prospect/telefone na organização.
  // Antes este filtro lia todos os cad_leads visíveis e podia remover conversas
  // válidas do Member antes da RPC rodar.
  let skippedDup = 0;
  if (digitsMap.size > 0) {
    const existingDigits = new Set<string>();
    const pageSz = 1000;
    for (let from = 0; ; from += pageSz) {
      const { data, error } = await db
        .from("cad_leads")
        .select("whatsapp,telefone")
        .eq("owner_id", ctx.uid)
        .neq("stage", "perdido")
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
  const fallbackIds: string[] = [];
  for (const batch of chunk(eligibleIds, 500)) {
    const { data, error } = await db.rpc("cad_import_from_prospects", { p_ids: batch });
    if (error) {
      const msg = String(error.message || "");
      // Duplicata em lote não pode descartar todos os outros leads válidos.
      // Repassa o lote para o fallback granular abaixo, que tenta item a item.
      if (!/duplicate key|unique constraint|ux_cad_leads_|cad_leads_.*uniq/i.test(msg)) {
        throw new Error(msg);
      }
      fallbackIds.push(...batch);
      continue;
    }
    const importedBatch = (data as number) ?? 0;
    imported += importedBatch;
    // Mesmo quando a RPC importa parte do lote, versões antigas no banco podem
    // deixar alguns prospects contatados de fora. Conferimos quais já viraram
    // card do usuário atual e mandamos os faltantes para o fallback granular.
    const { data: ownRows, error: ownError } = await db
      .from("cad_leads")
      .select("prospect_id")
      .eq("owner_id", ctx.uid)
      .in("prospect_id", batch);
    if (ownError) throw new Error(ownError.message);
    const ownSet = new Set(
      ((ownRows ?? []) as Array<{ prospect_id: string | null }>)
        .map((row) => row.prospect_id)
        .filter((id): id is string => Boolean(id)),
    );
    fallbackIds.push(...batch.filter((id) => !ownSet.has(id)));
  }

  if (fallbackIds.length > 0) {
    const uniqueFallbackIds = Array.from(new Set(fallbackIds));
    const byId = new Map(prospectRows.map((row) => [row.id, row]));
    const existingProspects = new Set<string>();
    for (const batch of chunk(uniqueFallbackIds, 200)) {
      const { data, error } = await db
        .from("cad_leads")
        .select("prospect_id")
        .eq("owner_id", ctx.uid)
        .in("prospect_id", batch);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{ prospect_id: string | null }>) {
        if (row.prospect_id) existingProspects.add(row.prospect_id);
      }
    }

    const fallbackPayload: Array<Partial<CadLead> & { empresa: string }> = [];
    for (const id of uniqueFallbackIds) {
      if (existingProspects.has(id)) continue;
      const privateStatus = privateStatusByProspect.get(id) ?? null;
      const hasPrivateContactSignal = Boolean(privateStatus && privateStatus !== "nao_contatado");
      if (!ownContactedProspects.has(id) && !hasPrivateContactSignal && memberScoped) continue;
      const p = byId.get(id);
      if (!p) continue;
      const firstContact = new Date(lastContactByProspect.get(id) ?? p.created_at ?? Date.now());
      fallbackPayload.push({
        organization_id: ctx.orgId,
        owner_id: ctx.uid,
        prospect_id: p.id,
        empresa: p.company?.trim() || "Sem nome",
        responsavel: p.owner_name ?? null,
        telefone: p.phone ?? null,
        whatsapp: p.whatsapp ?? null,
        primeira_abordagem_at: firstContact.toISOString(),
        stage: "followup_1",
        next_action_at: new Date(firstContact.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    for (const batch of chunk(fallbackPayload, 200)) {
      if (batch.length === 0) continue;
      const { data, error } = await db
        .from("cad_leads")
        .insert(batch)
        .select("id");
      if (error) {
        const msg = String(error.message || "");
        if (!/duplicate key|unique constraint|ux_cad_leads_|cad_leads_.*uniq/i.test(msg)) {
          throw new Error(msg);
        }
        // Se o lote bateu em UMA duplicidade antiga/global, salva o restante
        // individualmente para não perder as 4 conversas iniciadas do usuário.
        for (const item of batch) {
          const { data: oneData, error: oneError } = await db
            .from("cad_leads")
            .insert(item)
            .select("id")
            .maybeSingle();
          if (oneError) {
            const oneMsg = String(oneError.message || "");
            if (!/duplicate key|unique constraint|ux_cad_leads_|cad_leads_.*uniq/i.test(oneMsg)) {
              throw new Error(oneMsg);
            }
            // Banco externo antigo pode ainda ter unique global por prospect_id.
            // Nesse caso, cria o card privado sem vínculo direto para não bloquear
            // a cadência do Member que iniciou a conversa.
            const { data: detachedData, error: detachedError } = await db
              .from("cad_leads")
              .insert({ ...item, prospect_id: null })
              .select("id")
              .maybeSingle();
            if (!detachedError && detachedData) {
              imported += 1;
              continue;
            }
            if (detachedError) {
              const detachedMsg = String(detachedError.message || "");
              if (!/duplicate key|unique constraint|ux_cad_leads_|cad_leads_.*uniq/i.test(detachedMsg)) {
                throw new Error(detachedMsg);
              }
            }
            skippedDup += 1;
            continue;
          }
          if (oneData) imported += 1;
        }
        continue;
      }
      imported += ((data ?? []) as Array<{ id: string }>).length;
    }
  }

  // Limpa cards que entraram antes dessa regra: remove leads vinculados a prospects
  // ainda `nao_contatado` e SEM nenhum disparo registrado (preserva histórico real).
  let cleaned = 0;
  for (const batch of chunk(naoContatadoIds, 200)) {
    const { data, error } = await db
      .from("cad_leads")
      .delete()
      .eq("owner_id", ctx.uid)
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