import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getProspectIdentityKey } from "@/lib/prospect-identity";
import { normalizeCity, isValidCityName, cleanCityLabel } from "@/lib/city-name";
import { renderTemplate, sanitizeTemplateForSend } from "@/lib/cadencia/types";
import { pickNicheKey, pickNicheTemplate, NICHE_LABELS } from "@/lib/prospeccao/niche-templates";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DISPATCH_TIPOS = ["whatsapp", "ligacao", "email"] as const;

export type ProspectRow = {
  id: string;
  company: string | null;
  owner_name: string | null;
  cnpj: string | null;
  segment: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  created_at: string | null;
};

const PROSPECT_COLS =
  "id, company, owner_name, cnpj, segment, whatsapp, phone, email, city, state, created_at";

/** Telefone brasileiro em formato internacional (somente dígitos, com 55). */
export function normalizeWhats(raw: string | null | undefined): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.startsWith("55")) return d.length >= 12 && d.length <= 13 ? d : null;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return null;
}

/** Ids de prospects já disparados por este usuário (qualquer data). */
async function dispatchedIds(
  admin: SupabaseClient<Database>,
  userId: string,
  ids: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const BATCH = 200;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const { data, error } = await (admin as any)
      .from("prospect_touchpoints")
      .select("prospect_id")
      .eq("user_id", userId)
      .in("tipo", DISPATCH_TIPOS as unknown as string[])
      .in("prospect_id", slice);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ prospect_id: string }>) out.add(r.prospect_id);
  }
  return out;
}

export type QueueFilters = {
  limit: number;
  state?: string | null;
  city?: string | null;
  niche?: string | null;
};

export type QueueItem = {
  prospect_id: string;
  company: string;
  contact_name: string;
  whatsapp: string;
  phone: string | null;
  email: string | null
  city: string;
  state: string;
  niche: string;
  cnpj: string | null;
  message: string;
};

/**
 * Fila de leads a disparar para o usuário dono da chave:
 * WhatsApp válido, sem disparo anterior desse usuário, sem duplicados de
 * identidade (CNPJ/WhatsApp/nome+cidade) e com a mensagem já personalizada.
 */
export async function buildQueue(
  admin: SupabaseClient<Database>,
  orgId: string,
  userId: string,
  filters: QueueFilters,
): Promise<QueueItem[]> {
  const CANDIDATE_PAGE = 1000;
  const wantCity = filters.city ? normalizeCity(filters.city) : null;
  const wantNiche = filters.niche ? String(filters.niche).trim().toLowerCase() : null;

  const seenIdentity = new Set<string>();
  const picked: ProspectRow[] = [];

  for (let from = 0; from < 5000 && picked.length < filters.limit; from += CANDIDATE_PAGE) {
    let query = (admin as any)
      .from("prospects")
      .select(PROSPECT_COLS)
      .eq("organization_id", orgId)
      .is("merged_into", null)
      .not("whatsapp", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + CANDIDATE_PAGE - 1);
    if (filters.state) query = query.eq("state", filters.state.trim().toUpperCase());

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as ProspectRow[];
    if (!page.length) break;

    const prefiltered = page.filter((p) => {
      if (!normalizeWhats(p.whatsapp)) return false;
      if (wantCity && normalizeCity(p.city) !== wantCity) return false;
      if (wantNiche) {
        const key = pickNicheKey(p.company ?? "", p.segment);
        const label = String(NICHE_LABELS[key] ?? "").toLowerCase();
        if (key !== wantNiche && !label.includes(wantNiche)) return false;
      }
      return true;
    });

    if (prefiltered.length) {
      const done = await dispatchedIds(admin, userId, prefiltered.map((p) => p.id));
      for (const p of prefiltered) {
        if (done.has(p.id)) continue;
        const key = getProspectIdentityKey(p as Record<string, any>);
        if (seenIdentity.has(key)) continue;
        seenIdentity.add(key);
        picked.push(p);
        if (picked.length >= filters.limit) break;
      }
    }
    if (page.length < CANDIDATE_PAGE) break;
  }

  const contatos = await contactNames(admin, picked.map((p) => p.id));
  const template = await resolveTemplate(admin, orgId);

  return picked.map((p) => ({
    prospect_id: p.id,
    company: p.company ?? "",
    contact_name: contatos.get(p.id) ?? "",
    whatsapp: normalizeWhats(p.whatsapp)!,
    phone: p.phone ?? null,
    email: p.email ?? null,
    city: isValidCityName(p.city) ? cleanCityLabel(p.city) : "",
    state: (p.state ?? "").toUpperCase(),
    niche: NICHE_LABELS[pickNicheKey(p.company ?? "", p.segment)] ?? "",
    cnpj: p.cnpj ?? null,
    message: personalize(template, p, contatos.get(p.id) ?? ""),
  }));
}

/** Nome do contato oficial (cad_leads.responsavel), quando existir. */
async function contactNames(
  admin: SupabaseClient<Database>,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await (admin as any)
    .from("cad_leads")
    .select("prospect_id, responsavel")
    .in("prospect_id", ids);
  for (const r of (data ?? []) as Array<{ prospect_id: string | null; responsavel: string | null }>) {
    if (r.prospect_id && r.responsavel) out.set(r.prospect_id, r.responsavel);
  }
  return out;
}

/**
 * Texto base da primeira abordagem: mensagem confirmada em Meu Negócio,
 * com o template de cadência (followup_1) como reserva. `null` = usar
 * o template do nicho do lead.
 */
export async function resolveTemplate(
  admin: SupabaseClient<Database>,
  orgId: string,
): Promise<string | null> {
  const { data: biz } = await (admin as any)
    .from("business_profiles")
    .select("initial_message")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1);
  const bizMsg = (Array.isArray(biz) ? biz[0] : null)?.initial_message as string | undefined;
  if (bizMsg && bizMsg.trim()) return bizMsg;

  const { data: tpl } = await (admin as any)
    .from("cad_templates")
    .select("corpo")
    .eq("organization_id", orgId)
    .eq("stage", "followup_1")
    .order("updated_at", { ascending: false })
    .limit(1);
  const corpo = (Array.isArray(tpl) ? tpl[0] : null)?.corpo as string | undefined;
  if (corpo && corpo.trim()) return corpo;

  return null;
}

/** Aplica as variáveis do lead e limpa placeholders remanescentes. */
export function personalize(
  template: string | null,
  p: Pick<ProspectRow, "company" | "segment">,
  contactName: string,
): string {
  const base = template ?? pickNicheTemplate(p.company ?? "", p.segment);
  return sanitizeTemplateForSend(
    renderTemplate(base, { empresa: p.company ?? "", responsavel: contactName } as never),
  );
}

export async function getProspect(
  admin: SupabaseClient<Database>,
  orgId: string,
  prospectId: string,
): Promise<ProspectRow | null> {
  const { data, error } = await (admin as any)
    .from("prospects")
    .select(PROSPECT_COLS)
    .eq("organization_id", orgId)
    .eq("id", prospectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ProspectRow | null;
}

export async function contactNameFor(
  admin: SupabaseClient<Database>,
  prospectId: string,
): Promise<string> {
  const map = await contactNames(admin, [prospectId]);
  return map.get(prospectId) ?? "";
}

/** Já existe um registro com esse external_id? (idempotência) */
export async function hasExternalId(
  admin: SupabaseClient<Database>,
  userId: string,
  prospectId: string,
  externalId: string,
): Promise<boolean> {
  const { data } = await (admin as any)
    .from("prospect_touchpoints")
    .select("id")
    .eq("user_id", userId)
    .eq("prospect_id", prospectId)
    .ilike("mensagem", `%[ext:${externalId}]%`)
    .limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}

async function insertTouchpoint(
  admin: SupabaseClient<Database>,
  row: Record<string, unknown>,
): Promise<{ id: string; enviado_em: string }> {
  const { data, error } = await (admin as any)
    .from("prospect_touchpoints")
    .insert(row)
    .select("id, enviado_em")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; enviado_em: string };
}

/** Registra o disparo feito pela ferramenta externa. */
export async function recordSent(
  admin: SupabaseClient<Database>,
  args: {
    orgId: string;
    userId: string;
    prospectId: string;
    channel: string;
    message?: string | null;
    externalId?: string | null;
    sentAt?: string | null;
  },
): Promise<{ id: string; enviado_em: string }> {
  const suffix = args.externalId ? ` [ext:${args.externalId}]` : "";
  const tp = await insertTouchpoint(admin, {
    prospect_id: args.prospectId,
    user_id: args.userId,
    organization_id: args.orgId,
    tipo: args.channel,
    mensagem: `${(args.message ?? "").slice(0, 4000)}${suffix}`,
    resultado: "enviado",
    by_name: "API",
    enviado_em: args.sentAt ?? new Date().toISOString(),
  });
  // Estado privado do lead: sai da fila de "não contactado".
  await setPrivateStatus(admin, args, "primeiro_contato");
  return tp;
}

/** Registra a resposta recebida e, opcionalmente, o novo status do lead. */
export async function recordReply(
  admin: SupabaseClient<Database>,
  args: {
    orgId: string;
    userId: string;
    prospectId: string;
    text: string;
    receivedAt?: string | null;
    status?: string | null;
  },
): Promise<{ id: string; enviado_em: string }> {
  const tp = await insertTouchpoint(admin, {
    prospect_id: args.prospectId,
    user_id: args.userId,
    organization_id: args.orgId,
    tipo: "resposta",
    mensagem: args.text.slice(0, 4000),
    resultado: "enviado",
    by_name: "API",
    enviado_em: args.receivedAt ?? new Date().toISOString(),
  });
  if (args.status) await setPrivateStatus(admin, args, args.status);
  return tp;
}

async function setPrivateStatus(
  admin: SupabaseClient<Database>,
  args: { orgId: string; userId: string; prospectId: string },
  status: string,
): Promise<void> {
  try {
    await insertTouchpoint(admin, {
      prospect_id: args.prospectId,
      user_id: args.userId,
      organization_id: args.orgId,
      tipo: "status",
      mensagem: `status:${status}`,
      resultado: "enviado",
      by_name: "API",
      enviado_em: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[api-public] setPrivateStatus falhou", err);
  }
}

export const DISPATCH_STATUSES = [
  "primeiro_contato",
  "em_conversa",
  "interessado",
  "agendado",
  "qualificado",
  "sem_interesse",
  "descartado",
] as const;

export const DISPATCH_CHANNELS = ["whatsapp", "ligacao", "email"] as const;
