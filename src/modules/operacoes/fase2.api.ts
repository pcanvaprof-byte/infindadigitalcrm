import { supabase } from "@/integrations/supabase/client";
import type {
  OpCampaign,
  OpContractRenewal,
  OpDeployment,
  OpDeploymentCategory,
  OpDeploymentPriority,
  OpDeploymentStatus,
  OpExecMetrics,
  OpInteraction,
  OpInteractionType,
  OpOnboarding,
  OpOnboardingProgress,
  OpRenewalView,
} from "./fase2.types";

const db = supabase as unknown as { from: (t: string) => any };

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada. Faça login novamente.");
  return data.user.id;
}

function clean(v: unknown): string | null {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

// ============================================================================
// Onboarding
// ============================================================================
export async function listOnboardings(): Promise<OpOnboarding[]> {
  const { data, error } = await db
    .from("op_onboarding")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OpOnboarding[];
}

export async function listOnboardingProgress(): Promise<OpOnboardingProgress[]> {
  const { data, error } = await db.from("op_onboarding_progress").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as OpOnboardingProgress[];
}

export async function getOnboardingByClient(clientId: string): Promise<OpOnboarding | null> {
  const { data, error } = await db
    .from("op_onboarding")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as OpOnboarding | null;
}

export async function upsertOnboarding(
  input: Partial<OpOnboarding> & { client_id: string },
): Promise<OpOnboarding> {
  const owner_id = await currentUserId();
  const payload: Record<string, unknown> = {
    client_id: input.client_id,
    owner_id,
    company_name: clean(input.company_name),
    cnpj: clean(input.cnpj),
    website: clean(input.website),
    instagram: clean(input.instagram),
    facebook: clean(input.facebook),
    youtube: clean(input.youtube),
    meta_ads_connected: !!input.meta_ads_connected,
    google_ads_connected: !!input.google_ads_connected,
    analytics_connected: !!input.analytics_connected,
    tag_manager_connected: !!input.tag_manager_connected,
    goal_type: clean(input.goal_type),
    status: input.status ?? "pendente",
  };
  if (input.id) {
    const { data, error } = await db
      .from("op_onboarding")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OpOnboarding;
  }
  const { data, error } = await db
    .from("op_onboarding")
    .upsert(payload, { onConflict: "owner_id,client_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as OpOnboarding;
}

// ============================================================================
// Implantação
// ============================================================================
export type DeploymentFilters = {
  clientId?: string;
  category?: OpDeploymentCategory;
  status?: OpDeploymentStatus;
  priority?: OpDeploymentPriority;
  search?: string;
};

export async function listDeployments(f: DeploymentFilters = {}): Promise<OpDeployment[]> {
  let q = db.from("op_deployments").select("*").order("created_at", { ascending: false });
  if (f.clientId) q = q.eq("client_id", f.clientId);
  if (f.category) q = q.eq("category", f.category);
  if (f.status) q = q.eq("status", f.status);
  if (f.priority) q = q.eq("priority", f.priority);
  if (f.search?.trim()) q = q.ilike("title", `%${f.search.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OpDeployment[];
}

export async function createDeployment(
  input: Partial<OpDeployment> & { client_id: string; title: string; category: OpDeploymentCategory },
): Promise<OpDeployment> {
  const owner_id = await currentUserId();
  const payload: Record<string, unknown> = {
    client_id: input.client_id,
    owner_id,
    title: input.title.trim(),
    description: clean(input.description),
    category: input.category,
    status: input.status ?? "nao_iniciado",
    priority: input.priority ?? "Normal",
    assigned_to: input.assigned_to || null,
    due_date: input.due_date || null,
  };
  const { data, error } = await db.from("op_deployments").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as OpDeployment;
}

export async function updateDeployment(
  id: string,
  patch: Partial<OpDeployment>,
): Promise<OpDeployment> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.description !== undefined) payload.description = clean(patch.description);
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.due_date !== undefined) payload.due_date = patch.due_date || null;
  if (patch.client_id !== undefined) payload.client_id = patch.client_id;
  const { data, error } = await db
    .from("op_deployments")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as OpDeployment;
}

export async function deleteDeployment(id: string): Promise<void> {
  const { error } = await db.from("op_deployments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Campanhas (gestão)
// ============================================================================
export type CampaignFilters = { clientId?: string; status?: string; platform?: string };

export async function listOpCampaigns(f: CampaignFilters = {}): Promise<OpCampaign[]> {
  let q = db.from("op_campaigns").select("*").order("created_at", { ascending: false });
  if (f.clientId) q = q.eq("client_id", f.clientId);
  if (f.status) q = q.eq("status", f.status);
  if (f.platform) q = q.eq("platform", f.platform);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OpCampaign[];
}

export async function upsertOpCampaign(
  input: Partial<OpCampaign> & { client_id: string; campaign_name: string; platform: OpCampaign["platform"] },
): Promise<OpCampaign> {
  const owner_id = await currentUserId();
  const payload: Record<string, unknown> = {
    client_id: input.client_id,
    owner_id,
    campaign_name: input.campaign_name.trim(),
    platform: input.platform,
    objective: clean(input.objective),
    daily_budget: Number(input.daily_budget ?? 0) || 0,
    monthly_budget: Number(input.monthly_budget ?? 0) || 0,
    investment_to_date: Number(input.investment_to_date ?? 0) || 0,
    results_count: Number(input.results_count ?? 0) || 0,
    cost_per_result: Number(input.cost_per_result ?? 0) || 0,
    status: input.status ?? "rascunho",
    start_date: input.start_date || null,
    end_date: input.end_date || null,
  };
  if (input.id) {
    const { data, error } = await db
      .from("op_campaigns")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OpCampaign;
  }
  const { data, error } = await db.from("op_campaigns").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as OpCampaign;
}

export async function deleteOpCampaign(id: string): Promise<void> {
  const { error } = await db.from("op_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Relacionamento
// ============================================================================
export async function listInteractions(clientId?: string): Promise<OpInteraction[]> {
  let q = db
    .from("op_client_interactions")
    .select("*")
    .order("interaction_date", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OpInteraction[];
}

export async function listPendingFollowups(): Promise<OpInteraction[]> {
  const { data, error } = await db
    .from("op_client_interactions")
    .select("*")
    .not("next_followup_at", "is", null)
    .order("next_followup_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OpInteraction[];
}

export async function createInteraction(
  input: Partial<OpInteraction> & {
    client_id: string;
    title: string;
    interaction_type: OpInteractionType;
  },
): Promise<OpInteraction> {
  const owner_id = await currentUserId();
  const payload: Record<string, unknown> = {
    client_id: input.client_id,
    owner_id,
    created_by: owner_id,
    interaction_type: input.interaction_type,
    title: input.title.trim(),
    notes: clean(input.notes),
    interaction_date: input.interaction_date ?? new Date().toISOString(),
    next_followup_at: input.next_followup_at || null,
  };
  const { data, error } = await db
    .from("op_client_interactions")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as OpInteraction;
}

export async function deleteInteraction(id: string): Promise<void> {
  const { error } = await db.from("op_client_interactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Renovações
// ============================================================================
export async function listRenewals(): Promise<OpRenewalView[]> {
  const { data, error } = await db
    .from("op_renewals_status")
    .select("*")
    .order("contract_end", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OpRenewalView[];
}

export async function upsertRenewal(
  input: Partial<OpContractRenewal> & { client_id: string; contract_end: string },
): Promise<OpContractRenewal> {
  const owner_id = await currentUserId();
  const payload: Record<string, unknown> = {
    client_id: input.client_id,
    owner_id,
    contract_start: input.contract_start || null,
    contract_end: input.contract_end,
    renewal_status: input.renewal_status ?? "ativo",
    notes: clean(input.notes),
  };
  if (input.id) {
    const { data, error } = await db
      .from("op_contract_renewals")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OpContractRenewal;
  }
  const { data, error } = await db
    .from("op_contract_renewals")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as OpContractRenewal;
}

export async function deleteRenewal(id: string): Promise<void> {
  const { error } = await db.from("op_contract_renewals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Dashboard Executivo (via view)
// ============================================================================
export async function getExecutiveMetrics(): Promise<OpExecMetrics> {
  const { data, error } = await db
    .from("op_dashboard_exec_metrics")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const empty: OpExecMetrics = {
    total_clientes: 0, clientes_ativos: 0, clientes_inativos: 0,
    onboarding_pendente: 0, onboarding_em_configuracao: 0, onboarding_concluido: 0,
    deployments_total: 0, deployments_concluidos: 0, deployments_andamento: 0,
    campanhas_ativas: 0, campanhas_pausadas: 0, campanhas_encerradas: 0,
    interacoes_30d: 0,
    clientes_sem_onboarding: 0, clientes_sem_campanha_ativa: 0,
    clientes_com_implantacao_pendente: 0, contratos_vencendo_30d: 0,
  };
  return (data ?? empty) as OpExecMetrics;
}