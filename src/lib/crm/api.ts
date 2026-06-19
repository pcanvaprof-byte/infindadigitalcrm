import { supabase } from "@/integrations/supabase/client";

// Tipos do CRM persistido (Fase 5A)
export interface DealStage {
  id: string;
  label: string;
  tone: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface Client {
  id: string;
  user_id: string;
  prospect_id: string | null;
  company: string;
  cnpj: string | null;
  segment: string | null;
  contact_name: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  city: string | null;
  state: string | null;
  owner_name: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  user_id: string;
  client_id: string;
  prospect_id: string | null;
  title: string;
  value: number;
  stage_id: string;
  owner_name: string | null;
  expected_close: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealWithClient extends Deal {
  client: Pick<Client, "id" | "company" | "city" | "state" | "contact_name" | "segment" | "whatsapp"> | null;
}

// Chaves canônicas — usadas pelas mutações para invalidar caches.
export const crmKeys = {
  stages: ["crm", "stages"] as const,
  deals: ["crm", "deals"] as const,
  clients: ["crm", "clients"] as const,
  dealActivities: (dealId: string) => ["crm", "deal-activities", dealId] as const,
  dashboardKpis: ["dashboard", "kpis"] as const,
  prospects: ["prospects"] as const,
};

// Sem types regenerados ainda — usa o client como genérico permissivo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export async function listDealStages(): Promise<DealStage[]> {
  const { data, error } = await sb
    .from("deal_stages")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DealStage[];
}

export async function listDeals(): Promise<DealWithClient[]> {
  const { data, error } = await sb
    .from("deals")
    .select("*, client:clients(id, company, city, state, contact_name, segment, whatsapp)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DealWithClient[];
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await sb
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function moveDealStage(dealId: string, stageId: string): Promise<void> {
  const { error } = await sb.from("deals").update({ stage_id: stageId }).eq("id", dealId);
  if (error) throw error;
}

export async function updateDeal(dealId: string, patch: Partial<Deal>): Promise<void> {
  const { error } = await sb.from("deals").update(patch).eq("id", dealId);
  if (error) throw error;
}

export interface ConvertResult {
  client_id: string;
  deal_id: string;
  created: boolean;
}

export async function convertProspectToClient(
  prospectId: string,
  opts: { dealValue?: number; dealTitle?: string } = {},
): Promise<ConvertResult> {
  const { data, error } = await sb.rpc("convert_prospect_to_client", {
    p_prospect_id: prospectId,
    p_deal_value: opts.dealValue ?? 0,
    p_deal_title: opts.dealTitle ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as ConvertResult;
}