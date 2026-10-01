import { supabase } from "@/integrations/supabase/client";
import { getProspectPhoneKeys } from "./prospect-identity";

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

async function siblingProspectIds(prospectId: string): Promise<string[]> {
  // Busca o prospect atual para pegar CNPJ/WhatsApp/Nome
  const { data: p } = await db
    .from("prospects")
    .select("id, cnpj, whatsapp, phone, company, city, organization_id")
    .eq("id", prospectId)
    .maybeSingle();

  if (!p) return [prospectId];

  const ids = new Set<string>([prospectId]);
  const base = () => db.from("prospects").select("id").eq("organization_id", p.organization_id);

  const collect = async (q: any) => {
    const { data } = await q;
    for (const r of ((data as { id: string }[] | null) ?? [])) ids.add(r.id);
  };

  // 1) Mesma raiz de CNPJ (8 dígitos)
  const cnpj = String(p.cnpj || "").replace(/\D/g, "");
  if (cnpj.length >= 8) await collect(base().like("cnpj", `${cnpj.slice(0, 8)}%`));

  // 2) Mesmo telefone — vale mesmo com CNPJ diferente (o disparo vai pro número).
  const phones = getProspectPhoneKeys(p as Record<string, unknown>);
  for (const tel of phones) {
    await collect(base().or(`whatsapp.ilike.%${tel}%,phone.ilike.%${tel}%`));
  }

  // 3) Sem CNPJ e sem telefone: nome + cidade
  if (cnpj.length < 8 && !phones.length && p.company) {
    await collect(base().eq("company", p.company).eq("city", p.city));
  }

  return [...ids];
}

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

async function touchpointToday(prospectIds: string[], userId?: string): Promise<boolean> {
  const since = lockWindowSinceISO();
  let query = db
    .from("prospect_touchpoints")
    .select("id")
    .in("prospect_id", prospectIds)
    .in("tipo", ["whatsapp", "ligacao", "email"])
    .gte("enviado_em", since);
  
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.limit(1);
  if (error) return false;
  return ((data as unknown[]) ?? []).length > 0;
}

async function cadMessageToday(leadIds: string[], userId?: string): Promise<boolean> {
  const since = lockWindowSinceISO();
  let query = db
    .from("cad_messages")
    .select("id")
    .in("lead_id", leadIds)
    .eq("direction", "out")
    .gte("created_at", since);
  
  if (userId) {
    query = query.eq("owner_id", userId);
  }

  const { data, error } = await query.limit(1);
  if (error) return false;
  return ((data as unknown[]) ?? []).length > 0;
}

export async function wasDispatchedToday(input: {
  prospectId?: string | null;
  leadId?: string | null;
  userId?: string | null;
}): Promise<{ blocked: boolean; source?: DispatchSource }> {
  let { prospectId, leadId, userId } = input;
  try {
    if (prospectId && !leadId) leadId = await leadIdFromProspect(prospectId);
    if (leadId && !prospectId) prospectId = await prospectIdFromLead(leadId);

    if (prospectId) {
      const siblings = await siblingProspectIds(prospectId);
      if (await touchpointToday(siblings, userId || undefined)) {
        return { blocked: true, source: "Prospecção" };
      }
      
      // Busca lead_ids para todos os irmãos
      const { data: leads } = await db.from("cad_leads").select("id").in("prospect_id", siblings);
      const leadIds = (leads as { id: string }[] | null)?.map(l => l.id) || [];
      if (leadIds.length > 0 && (await cadMessageToday(leadIds, userId || undefined))) {
        return { blocked: true, source: "Cadência" };
      }
    } else if (leadId) {
       if (await cadMessageToday([leadId], userId || undefined)) {
         return { blocked: true, source: "Cadência" };
       }
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
