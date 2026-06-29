import { supabase } from "@/integrations/supabase/client";
import type {
  ClientTimelineItem,
  CommercialPlan,
  LifecycleClient,
  PipelineStage,
  PlanTemplate,
} from "./types";

const db = supabase as unknown as { from: (t: string) => any };

export async function listClients(filter?: { stage?: PipelineStage }): Promise<LifecycleClient[]> {
  let q = db.from("clients").select("*").order("updated_at", { ascending: false });
  if (filter?.stage) q = q.eq("pipeline_stage", filter.stage);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LifecycleClient[];
}

export async function getClient(id: string): Promise<LifecycleClient | null> {
  const { data, error } = await db.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LifecycleClient) ?? null;
}

export async function advanceStage(id: string, to: PipelineStage, reason?: string): Promise<LifecycleClient> {
  const { data, error } = await db
    .from("clients")
    .update({ pipeline_stage: to, current_step: reason ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as LifecycleClient;
}

export async function logEvent(clientId: string, type: string, payload: Record<string, unknown> = {}) {
  const { error } = await db
    .from("client_events")
    .insert({ client_id: clientId, type, payload });
  if (error) throw new Error(error.message);
}

export async function getTimeline(clientId: string): Promise<ClientTimelineItem[]> {
  const { data, error } = await db
    .from("client_timeline")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientTimelineItem[];
}

export async function listPlanTemplates(): Promise<PlanTemplate[]> {
  const { data, error } = await db.from("plan_templates").select("*").order("mensalidade");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanTemplate[];
}

export async function getCommercialPlan(clientId: string): Promise<CommercialPlan | null> {
  const { data, error } = await db
    .from("commercial_plans")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CommercialPlan) ?? null;
}

export async function upsertCommercialPlan(input: Partial<CommercialPlan> & { client_id: string }) {
  const payload = {
    client_id: input.client_id,
    investimento_gestao: input.investimento_gestao ?? null,
    investimento_trafego: input.investimento_trafego ?? null,
    objetivo: input.objetivo ?? null,
    entregas: input.entregas ?? [],
    cronograma: input.cronograma ?? {},
    validade_dias: input.validade_dias ?? 7,
    plano_code: input.plano_code ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from("commercial_plans")
    .upsert(payload, { onConflict: "client_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CommercialPlan;
}

export async function createClient(input: {
  company: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  cnpj?: string;
}): Promise<LifecycleClient> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado");
  const { data, error } = await db
    .from("clients")
    .insert({
      user_id: u.user.id,
      company: input.company,
      contact_name: input.contact_name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      cnpj: input.cnpj ?? null,
      pipeline_stage: "PROSPECCAO",
      created_from: "manual",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as LifecycleClient;
}

export async function updateClient(
  id: string,
  patch: Partial<
    Pick<
      LifecycleClient,
      | "company"
      | "cnpj"
      | "contact_name"
      | "email"
      | "phone"
      | "whatsapp"
      | "plano_code"
      | "mensalidade"
      | "financial_status"
      | "lc_contract_status"
      | "onboarding_status"
      | "activated_at"
      | "next_action_date"
      | "current_step"
      | "contract_term_months"
      | "contract_end_at"
      | "is_permuta"
      | "permuta_value"
      | "permuta_description"
      | "site_one_time_value"
      | "site_recurring_value"
      | "site_payment_status"
      | "contract_notes"
    >
  >,
): Promise<LifecycleClient> {
  const payload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await db
    .from("clients")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as LifecycleClient;
}