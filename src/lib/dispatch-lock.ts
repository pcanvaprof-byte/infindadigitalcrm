import { supabase } from "@/integrations/supabase/client";

/**
 * Trava anti-disparo duplicado nas últimas 24h (janela deslizante).
 * Verifica tanto Prospecção (prospect_touchpoints) quanto Cadência (cad_messages outbound).
 * Retorna { blocked, source } indicando onde já houve disparo hoje.
 */

type DispatchSource = "Prospecção" | "Cadência";

const LOCK_WINDOW_HOURS = 24;

function lockWindowSinceISO(): string {
  return new Date(Date.now() - LOCK_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

const db = supabase as unknown as {
  from: (t: string) => any;
};

async function leadIdFromProspect(prospectId: string): Promise<string | null> {
  const { data } = await db
    .from("cad_leads")
    .select("id")
    .eq("prospect_id", prospectId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function prospectIdFromLead(leadId: string): Promise<string | null> {
  const { data } = await db
    .from("cad_leads")
    .select("prospect_id")
    .eq("id", leadId)
    .maybeSingle();
  return (data as { prospect_id: string | null } | null)?.prospect_id ?? null;
}

async function touchpointToday(prospectId: string): Promise<boolean> {
  const since = lockWindowSinceISO();
  const { data, error } = await db
    .from("prospect_touchpoints")
    .select("id")
    .eq("prospect_id", prospectId)
    .in("tipo", ["whatsapp", "ligacao", "email"])
    .gte("enviado_em", since)
    .limit(1);
  if (error) return false;
  return ((data as unknown[]) ?? []).length > 0;
}

async function cadMessageToday(leadId: string): Promise<boolean> {
  const since = lockWindowSinceISO();
  const { data, error } = await db
    .from("cad_messages")
    .select("id")
    .eq("lead_id", leadId)
    .eq("direction", "out")
    .gte("created_at", since)
    .limit(1);
  if (error) return false;
  return ((data as unknown[]) ?? []).length > 0;
}

export async function wasDispatchedToday(input: {
  prospectId?: string | null;
  leadId?: string | null;
}): Promise<{ blocked: boolean; source?: DispatchSource }> {
  let { prospectId, leadId } = input;
  try {
    if (prospectId && !leadId) leadId = await leadIdFromProspect(prospectId);
    if (leadId && !prospectId) prospectId = await prospectIdFromLead(leadId);

    if (prospectId && (await touchpointToday(prospectId))) {
      return { blocked: true, source: "Prospecção" };
    }
    if (leadId && (await cadMessageToday(leadId))) {
      return { blocked: true, source: "Cadência" };
    }
    return { blocked: false };
  } catch (e) {
    console.warn("[dispatch-lock] erro ao verificar:", e);
    return { blocked: false };
  }
}

export function dispatchBlockedMessage(source: DispatchSource): string {
  return `Cliente já disparado nas últimas 24h em ${source}. Aguarde para novo contato.`;
}