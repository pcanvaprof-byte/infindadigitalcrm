import { ORIGEM_OPTIONS } from "./types";

const ORIGEM_VALUES = new Set(ORIGEM_OPTIONS.map((o) => o.value));

/**
 * Normaliza + valida os campos de origem antes de persistir.
 * - `origem`: aceita null/"" (limpa) ou um valor do allow-list; qualquer
 *   outra string vira erro em vez de ser gravada como texto livre.
 * - `origem_detalhe`: trim, limita a 240 chars; string vazia vira null.
 *   Só faz sentido quando há `origem` — se o patch limpa `origem`,
 *   `origem_detalhe` também é zerado por consistência.
 */
function normalizeOrigemPatch(patch: Record<string, unknown>) {
  if ("origem" in patch) {
    const raw = patch.origem;
    if (raw === null || raw === "" || raw === undefined) {
      patch.origem = null;
      // limpar detalhe junto para evitar detalhe órfão
      if ("origem_detalhe" in patch === false) patch.origem_detalhe = null;
      else if (patch.origem_detalhe != null) patch.origem_detalhe = null;
    } else if (typeof raw === "string") {
      const v = raw.trim();
      if (!ORIGEM_VALUES.has(v)) {
        throw new Error(
          `Origem inválida: "${v}". Selecione uma das opções da lista.`,
        );
      }
      patch.origem = v;
    } else {
      throw new Error("Origem inválida: valor precisa ser texto.");
    }
  }
  if ("origem_detalhe" in patch) {
    const raw = patch.origem_detalhe;
    if (raw == null) {
      patch.origem_detalhe = null;
    } else if (typeof raw === "string") {
      const v = raw.trim().slice(0, 240);
      patch.origem_detalhe = v.length ? v : null;
    } else {
      throw new Error("Detalhe da origem inválido: valor precisa ser texto.");
    }
  }
}

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
      | "origem"
      | "origem_detalhe"
      | "ajustes_escopo"
      | "ajustes_prazo"
      | "ajustes_proxima_acao"
      | "ajustes_updated_at"
    >
  >,
): Promise<LifecycleClient> {
  const payload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  // Be resilient to backends that haven't migrated new columns yet:
  // PostgREST returns PGRST204 / "Could not find the 'X' column" — strip
  // that key and retry until it succeeds or no unknown column remains.
  for (let i = 0; i < 12; i++) {
    const { data, error } = await db
      .from("clients")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (!error) return data as LifecycleClient;
    const m = /Could not find the '([^']+)' column/i.exec(error.message ?? "");
    if (!m || !(m[1] in payload)) throw new Error(error.message);
    delete payload[m[1]];
    // eslint-disable-next-line no-console
    console.warn(`[lifecycle/updateClient] coluna ausente no schema: ${m[1]} (ignorando)`);
  }
  throw new Error("Falha ao salvar cliente: schema desatualizado");
}