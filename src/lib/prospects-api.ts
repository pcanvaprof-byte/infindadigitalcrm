import { supabase } from "@/integrations/supabase/client";
import { dbExt } from "@/integrations/supabase/types.extra";
import type {
  Prospect,
  ProspectPotential,
  ProspectStatus,
  InteractionKind,
  Interaction,
} from "@/lib/mock-prospects";

type Row = {
  id: string;
  company: string;
  cnpj: string | null;
  segment: string;
  owner_name: string;
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  state: string;
  source: string;
  potential: string;
  status: string;
  created_at: string;
  updated_at: string;
  cadence_step?: number | null;
  cadence_status?: string | null;
  response_status?: string | null;
  last_contact_at?: string | null;
  next_contact_at?: string | null;
};

type IxRow = {
  id: string;
  prospect_id: string;
  // Linha originária de prospect_touchpoints (fonte única de verdade).
  kind: string;        // mapeado de touchpoints.tipo
  text: string;        // mapeado de touchpoints.mensagem
  by_name: string;     // touchpoints.by_name (pode ser '')
  created_at: string;  // mapeado de touchpoints.enviado_em
};

type DbErrorLike = { code?: string; message?: string };

const VALID_POTENTIALS = ["alto", "medio", "baixo"];
const VALID_STATUSES = [
  "nao_contatado",
  "primeiro_contato",
  "em_negociacao",
  "qualificado",
  "agendado",
  "perdido",
  "briefing_enviado",
  "diagnostico_pendente",
  "proposta_pendente",
  "proposta_enviada",
  "fechado_ganho",
  "aguardando_kickoff",
  "aguardando_producao",
  "em_producao",
  "entregue",
  "cliente",
];
const VALID_INTERACTION_KINDS = ["whatsapp", "ligacao", "email", "reuniao", "nota", "status"];

function fromRow(r: Row, ixs: IxRow[] = []): Prospect {
  const interactions = Array.isArray(ixs) ? ixs : [];
  return {
    id: r.id || crypto.randomUUID(),
    company: r.company || "Empresa sem nome",
    cnpj: r.cnpj ?? undefined,
    segment: r.segment || "Outros",
    owner: r.owner_name || "",
    whatsapp: r.whatsapp || "",
    phone: r.phone || "",
    email: r.email || "",
    instagram: r.instagram || "",
    city: r.city || "",
    state: r.state || "",
    source: r.source || "Importação",
    potential: (VALID_POTENTIALS.includes(r.potential) ? r.potential : "medio") as ProspectPotential,
    status: (VALID_STATUSES.includes(r.status) ? r.status : "nao_contatado") as ProspectStatus,
    // Mantém ISO; formatação acontece apenas na UI.
    createdAt: r.created_at || new Date(0).toISOString(),
    updatedAt: r.updated_at ?? null,
    cadenceStep: typeof r.cadence_step === "number" ? r.cadence_step : 0,
    cadenceStatus: (r.cadence_status as Prospect["cadenceStatus"]) ?? "ativo",
    responseStatus: (r.response_status as Prospect["responseStatus"]) ?? "sem_resposta",
    lastContactAt: r.last_contact_at ?? null,
    nextContactAt: r.next_contact_at ?? null,
    interactions: interactions
      .filter((i) => i.prospect_id === r.id)
      .map((i) => ({
        id: i.id || crypto.randomUUID(),
        kind: (VALID_INTERACTION_KINDS.includes(i.kind) ? i.kind : "nota") as InteractionKind,
        text: i.text || "",
        by: i.by_name || "",
        at: i.created_at || new Date(0).toISOString(),
      })),
  };
}

export async function loadAllProspects(): Promise<Prospect[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const role = await currentOrgRole();
  const ownOnlyTouchpoints = role !== "owner" && role !== "admin";
  // PostgREST limita 1000 linhas/consulta — paginar via range() até esgotar.
  const PAGE = 1000;
  const rows = await loadProspectRowsWithPrivateState(uid, PAGE);
  // Interações: também pagina e busca em lotes de ids (evita URL gigante no .in()).
  const ids = rows.map((r) => r.id);
  const ID_BATCH = 200;
  // Lotes de ids buscados em PARALELO (Promise.all) — antes era sequencial,
  // causando N round-trips quando a base passava de 1k prospects.
  type TpRow = {
    id: string; prospect_id: string; tipo: string;
    mensagem: string | null; by_name: string | null; enviado_em: string;
  };
  const slices: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) slices.push(ids.slice(i, i + ID_BATCH));
  const batchResults = await Promise.all(
    slices.map(async (slice) => {
      const out: TpRow[] = [];
      for (let from = 0; ; from += PAGE) {
        let query = dbExt
          .from("prospect_touchpoints")
          .select("id, prospect_id, tipo, mensagem, by_name, enviado_em")
          .in("prospect_id", slice);
        // Defesa no cliente: Member nunca carrega disparos/interações de outro usuário.
        // Owner/Admin mantêm visão completa para auditoria e gestão.
        if (ownOnlyTouchpoints) query = query.eq("user_id", uid);
        const { data, error } = await query
          .order("enviado_em", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) { console.warn("loadAllProspects touchpoints error", error); break; }
        const batch = (data ?? []) as TpRow[];
        out.push(...batch);
        if (batch.length < PAGE) break;
      }
      return out;
    }),
  );
  const ixs: IxRow[] = batchResults.flat().map((row) => ({
    id: row.id,
    prospect_id: row.prospect_id,
    kind: row.tipo,
    text: row.mensagem ?? "",
    by_name: row.by_name ?? "",
    created_at: row.enviado_em,
  }));
  return rows.map((r) => fromRow(r, ixs));
}

async function currentOrgRole(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("current_org_role" as never);
    if (error) return null;
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

async function loadProspectRowsWithPrivateState(uid: string, pageSize: number): Promise<Row[]> {
  return loadProspectRowsFallback(uid, pageSize);
}

async function loadProspectRowsFallback(uid: string, pageSize: number): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    // Fallback para bancos que ainda não possuem a view. Lê somente cadastro
    // compartilhado e zera operacional para não herdar trabalho de outro usuário.
    const { data, error } = await dbExt.from("prospects")
      .select("id,company,cnpj,segment,owner_name,whatsapp,phone,email,instagram,city,state,source,potential,created_at,updated_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("loadAllProspects fallback prospects error", error);
      throw new Error(`Falha ao carregar prospects: ${error.message}`);
    }
    const batch = ((data ?? []) as Partial<Row>[]).map(withDefaultPrivateState);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  const states = await loadPrivateStatesFromTouchpoints(uid, rows.map((r) => r.id), pageSize);
  return rows.map((row) => ({ ...row, ...(states.get(row.id) ?? {}) }));
}

async function loadPrivateStatesFromTouchpoints(uid: string, ids: string[], pageSize: number): Promise<Map<string, Partial<Row>>> {
  const out = new Map<string, Partial<Row>>();
  if (!ids.length) return out;
  const ID_BATCH = 200;
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const slice = ids.slice(i, i + ID_BATCH);
    for (let from = 0; ; from += pageSize) {
      const { data, error } = dbExt.from("prospect_touchpoints")
        .select("prospect_id,tipo,resultado,mensagem,enviado_em")
        .eq("user_id", uid)
        .in("prospect_id", slice)
        .in("tipo", ["whatsapp", "ligacao", "email", "reuniao", "resposta", "status"])
        .order("enviado_em", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) {
        console.warn("loadAllProspects private touchpoints fallback error", error);
        return out;
      }
      const batch = (data ?? []) as Array<{
        prospect_id: string;
        tipo: string | null;
        resultado: string | null;
        mensagem: string | null;
        enviado_em: string | null;
      }>;
      for (const event of batch) {
        const prev = out.get(event.prospect_id) ?? {};
        const next: Partial<Row> = { ...prev };
        const eventAt = event.enviado_em ?? null;
        if (eventAt && (!next.last_contact_at || new Date(eventAt) > new Date(next.last_contact_at))) {
          next.last_contact_at = eventAt;
        }
        if (event.tipo === "resposta" || event.resultado === "respondido" || event.resultado === "interessado") {
          next.response_status = "respondido";
          if (!next.status || next.status === "nao_contatado" || next.status === "primeiro_contato") next.status = "qualificado";
        } else if (event.tipo === "status") {
          const status = normalizePrivateStatus(event.resultado) ?? normalizePrivateStatus(event.mensagem);
          if (status && !next.status) next.status = status;
        } else if (!next.status) {
          next.status = "primeiro_contato";
        }
        out.set(event.prospect_id, next);
      }
      if (batch.length < pageSize) break;
    }
  }
  return out;
}

function withDefaultPrivateState(row: Partial<Row>): Row {
  return {
    id: row.id || crypto.randomUUID(),
    company: row.company || "Empresa sem nome",
    cnpj: row.cnpj ?? null,
    segment: row.segment || "Outros",
    owner_name: row.owner_name || "",
    whatsapp: row.whatsapp || "",
    phone: row.phone || "",
    email: row.email || "",
    instagram: row.instagram || "",
    city: row.city || "",
    state: row.state || "",
    source: row.source || "Importação",
    potential: row.potential || "medio",
    status: "nao_contatado",
    created_at: row.created_at || new Date(0).toISOString(),
    updated_at: row.updated_at || new Date(0).toISOString(),
    cadence_step: 0,
    cadence_status: "ativo",
    response_status: "sem_resposta",
    last_contact_at: null,
    next_contact_at: null,
  };
}

function isMissingRelation(error: DbErrorLike): boolean {
  return error.code === "PGRST205" || /schema cache|Could not find the table|does not exist/i.test(error.message ?? "");
}

function normalizePrivateStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  const stripped = raw.replace(/^status\s*:\s*/i, "");
  return VALID_STATUSES.includes(stripped) ? stripped : null;
}

async function currentUserId(): Promise<string | null> {
  if (_cachedUid) return _cachedUid;
  try {
    // Prefere a sessão já em memória (sem round-trip ao Auth).
    const { data: sess } = await supabase.auth.getSession();
    const sid = sess.session?.user?.id ?? null;
    if (sid) {
      _cachedUid = sid;
      _subscribeUidInvalidator();
      return sid;
    }
    const { data } = await supabase.auth.getUser();
    _cachedUid = data.user?.id ?? null;
    _subscribeUidInvalidator();
    return _cachedUid;
  } catch {
    return null;
  }
}

// Cache em memória do uid + invalidação em SIGNED_IN/OUT/USER_UPDATED.
let _cachedUid: string | null = null;
let _uidSubscribed = false;
function _subscribeUidInvalidator() {
  if (_uidSubscribed) return;
  _uidSubscribed = true;
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      // Só reage a transições de identidade. TOKEN_REFRESHED / INITIAL_SESSION
      // não trocam o usuário e apenas causariam re-escrita ruidosa do cache.
      if (event === "SIGNED_OUT") {
        _cachedUid = null;
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        _cachedUid = session?.user?.id ?? null;
      }
    });
  } catch { /* noop */ }
}

async function requireUserId(): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sessão expirada — entre novamente para salvar no banco.");
  return uid;
}

export async function insertProspect(p: Omit<Prospect, "id" | "createdAt" | "interactions">) {
  const uid = await requireUserId();
  const { data, error } = await dbExt.from("prospects")
    .insert({
      user_id: uid,
      company: p.company,
      cnpj: p.cnpj || null,
      segment: p.segment,
      owner_name: p.owner,
      whatsapp: p.whatsapp,
      phone: p.phone,
      email: p.email,
      instagram: p.instagram,
      city: p.city,
      state: p.state,
      source: p.source,
      potential: p.potential,
      status: p.status,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function updateProspect(id: string, patch: Partial<Prospect>) {
  console.log("[prospects-api] updateProspect:start", { id, patch });
  const uid = await requireUserId();
  // Arquitetura híbrida: campos operacionais privados vão para user_lead_state.
  // Somente cadastro compartilhado é gravado em prospects.
  const map: Record<string, unknown> = {};
  if (patch.company !== undefined) map.company = patch.company;
  if (patch.cnpj !== undefined) map.cnpj = patch.cnpj || null;
  if (patch.segment !== undefined) map.segment = patch.segment;
  if (patch.owner !== undefined) map.owner_name = patch.owner;
  if (patch.whatsapp !== undefined) map.whatsapp = patch.whatsapp;
  if (patch.phone !== undefined) map.phone = patch.phone;
  if (patch.email !== undefined) map.email = patch.email;
  if (patch.instagram !== undefined) map.instagram = patch.instagram;
  if (patch.city !== undefined) map.city = patch.city;
  if (patch.state !== undefined) map.state = patch.state;
  if (patch.source !== undefined) map.source = patch.source;
  if (patch.potential !== undefined) map.potential = patch.potential;
  if (Object.keys(map).length > 0) {
    const { error } = await dbExt.from("prospects").update(map as never).eq("id", id);
    if (error) {
      console.error("[prospects-api] updateProspect:error", { id, patch, error });
      throw error;
    }
  }
  // Estado operacional privado (por usuário): registrado no histórico de touchpoints.
  if (patch.status !== undefined) {
    const err = await savePrivateStatusTouchpoint(id, uid, String(patch.status));
    if (err) {
      console.error("[prospects-api] updateProspect:state_error", { id, err });
      throw new Error(err.message ?? "Falha ao salvar status privado");
    }
  }
  console.log("[prospects-api] updateProspect:ok", { id, fields: Object.keys(map), status: patch.status });
}

export async function deleteProspects(ids: string[]) {
  if (!ids.length) return;
  await requireUserId();
  const { error } = await dbExt.from("prospects").delete().in("id", ids);
  if (error) throw error;
}

export async function addInteractionRemote(
  prospectId: string,
  kind: InteractionKind,
  text: string,
  byName: string,
): Promise<Interaction | null> {
  const uid = await requireUserId();
  // Fonte única: grava em prospect_touchpoints.
  // 'status' e 'nota' viram resultado='enviado' (não disparam avanço de cadência via trigger).
  // 'whatsapp'|'ligacao'|'email' chamados aqui (fora de logAttempt) também são 'enviado'.
  const { data, error } = await dbExt
    .from("prospect_touchpoints")
    .insert({
      prospect_id: prospectId,
      user_id: uid,
      tipo: kind,
      mensagem: text,
      resultado: "enviado",
      by_name: byName,
    })
    .select("id, tipo, mensagem, by_name, enviado_em")
    .single();
  if (error) {
    console.warn("addInteraction error", error);
    return null;
  }
  const r = data as {
    id: string; tipo: string; mensagem: string | null; by_name: string | null; enviado_em: string;
  };
  return {
    id: r.id,
    kind: r.tipo as InteractionKind,
    text: r.mensagem ?? "",
    by: r.by_name ?? "",
    at: r.enviado_em,
  };
}

/** Insert em lote — 1 round-trip para N interações. Mantém atomicidade no Supabase. */
export async function addInteractionsBatch(
  items: { prospectId: string; kind: InteractionKind; text: string; byName: string }[],
): Promise<{ prospectId: string; ix: Interaction }[]> {
  if (!items.length) return [];
  const uid = await requireUserId();
  const payload = items.map((i) => ({
    prospect_id: i.prospectId,
    user_id: uid,
    tipo: i.kind,
    mensagem: i.text,
    resultado: "enviado",
    by_name: i.byName,
  }));
  const { data, error } = await dbExt
    .from("prospect_touchpoints")
    .insert(payload)
    .select("id, prospect_id, tipo, mensagem, by_name, enviado_em");
  if (error) {
    console.warn("addInteractionsBatch error", error);
    return [];
  }
  const rows = (data ?? []) as Array<{
    id: string; prospect_id: string; tipo: string; mensagem: string | null;
    by_name: string | null; enviado_em: string;
  }>;
  return rows.map((r) => ({
    prospectId: r.prospect_id,
    ix: {
      id: r.id,
      kind: r.tipo as InteractionKind,
      text: r.mensagem ?? "",
      by: r.by_name ?? "",
      at: r.enviado_em,
    },
  }));
}

/** Update em lote — 1 round-trip para N prospects (mesmo patch). */
export async function bulkUpdateProspects(
  ids: string[],
  patch: Partial<Pick<Prospect, "status" | "owner" | "potential">>,
): Promise<void> {
  if (!ids.length) return;
  const uid = await requireUserId();
  const map: Record<string, unknown> = {};
  if (patch.owner !== undefined) map.owner_name = patch.owner;
  if (patch.potential !== undefined) map.potential = patch.potential;
  if (Object.keys(map).length) {
    const { error } = await dbExt.from("prospects").update(map as never).in("id", ids);
    if (error) throw error;
  }
  // Status é privado por usuário — grava em lote no histórico de touchpoints.
  if (patch.status !== undefined) {
    const rows = ids.map((prospect_id) => ({
      prospect_id,
      user_id: uid,
      tipo: "status",
      resultado: String(patch.status),
      mensagem: `status:${String(patch.status)}`,
      by_name: "Sistema",
      enviado_em: new Date().toISOString(),
    }));
    const { error } = await dbExt
      .from("prospect_touchpoints")
      .insert(rows as never);
    if (error) throw error;
  }
}

/**
 * Registro do estado privado do usuário para um lead compartilhado.
 * Usa prospect_touchpoints porque essa tabela já está exposta no backend externo
 * e é a fonte única usada para disparos e importação para Cadência.
 */
async function savePrivateStatusTouchpoint(
  prospectId: string,
  userId: string,
  status: string,
): Promise<{ message?: string } | null> {
  const { error } = await dbExt
    .from("prospect_touchpoints")
    .insert({
      prospect_id: prospectId,
      user_id: userId,
      tipo: "status",
      resultado: status,
      mensagem: `status:${status}`,
      by_name: "Sistema",
      enviado_em: new Date().toISOString(),
    });
  return error ? { message: error.message } : null;
}

// ============ IMPORT ============

export interface PreviewRow {
  rowIndex: number; // 1-based line in the source file (header = 1)
  data: Omit<Prospect, "id" | "createdAt" | "interactions">;
  matchId?: string; // existing prospect id, when found by CNPJ
  errors: string[];
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  storage: "cloud";
}

/**
 * Insere novos e atualiza (somente campos vazios do existente) por CNPJ.
 */
export async function applyImport(
  rows: PreviewRow[],
  existing: Prospect[],
): Promise<ImportResult> {
  const uid = await requireUserId();
  const result: ImportResult = {
    inserted: 0, updated: 0, skipped: 0, errors: [], storage: "cloud",
  };

  const byCnpj = new Map<string, Prospect>();
  for (const e of existing) if (e.cnpj) byCnpj.set(e.cnpj, e);

  const toInsert: Record<string, unknown>[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  // dedupe within file by cnpj (keep first occurrence to avoid unique-index violation)
  const seenCnpjInFile = new Set<string>();
  for (const r of rows) {
    if (r.errors.length) {
      result.errors.push({ row: r.rowIndex, message: r.errors.join(" | ") });
      result.skipped++;
      continue;
    }
    const cnpj = r.data.cnpj || "";
    if (cnpj && seenCnpjInFile.has(cnpj)) {
      result.skipped++;
      continue;
    }
    if (cnpj) seenCnpjInFile.add(cnpj);
    const match = cnpj ? byCnpj.get(cnpj) : undefined;
    if (match) {
      // fill-empty-only
      const patch: Record<string, unknown> = {};
      const fields: (keyof Prospect)[] = [
        "company", "segment", "owner", "whatsapp", "phone",
        "email", "instagram", "city", "state", "source",
      ];
      const colMap: Record<string, string> = {
        company: "company", segment: "segment", owner: "owner_name",
        whatsapp: "whatsapp", phone: "phone", email: "email",
        instagram: "instagram", city: "city", state: "state", source: "source",
      };
      for (const f of fields) {
        const existingVal = (match[f] ?? "") as string;
        const newVal = (r.data[f as keyof typeof r.data] ?? "") as string;
        if (!existingVal && newVal) patch[colMap[f]] = newVal;
      }
      if (Object.keys(patch).length) {
        updates.push({ id: match.id, patch });
      } else {
        result.skipped++;
      }
    } else {
      toInsert.push({
        user_id: uid,
        company: r.data.company,
        cnpj: cnpj || null,
        segment: r.data.segment,
        owner_name: r.data.owner,
        whatsapp: r.data.whatsapp,
        phone: r.data.phone,
        email: r.data.email,
        instagram: r.data.instagram,
        city: r.data.city,
        state: r.data.state,
        source: r.data.source,
        potential: r.data.potential,
        status: r.data.status,
      });
    }
  }

  // Batch inserts (Supabase limits + avoid single failure killing whole import).
  // On batch error, retry row-by-row so partial successes are saved and errors localized.
  const BATCH = 500;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const slice = toInsert.slice(i, i + BATCH);
    const { data: ins, error } = await dbExt.from("prospects")
      .insert(slice as never)
      .select("id");
    if (!error) {
      result.inserted += ins?.length ?? 0;
      continue;
    }
    // fallback: per-row inserts to isolate offending rows
    for (const row of slice) {
      const { error: rowErr } = await dbExt.from("prospects")
        .insert(row as never)
        .select("id")
        .single();
      if (rowErr) {
        result.errors.push({ row: 0, message: `Inserção (${(row as { company?: string }).company ?? "?"}): ${rowErr.message}` });
        result.skipped++;
      } else {
        result.inserted++;
      }
    }
  }

  // Updates em paralelo, limitados a 10 simultâneos para não saturar o pool.
  const CONCURRENCY = 10;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const chunk = updates.slice(i, i + CONCURRENCY);
    const out = await Promise.all(
      chunk.map(async (u) => {
        const { error } = await dbExt.from("prospects").update(u.patch as never).eq("id", u.id);
        return { u, error };
      }),
    );
    for (const { u, error } of out) {
      if (error) result.errors.push({ row: 0, message: `Atualização ${u.id}: ${error.message}` });
      else result.updated++;
    }
  }

  return result;
}

// ============ IMPORT HISTORY ============

export interface ImportLog {
  id: string;
  fileName: string;
  performedBy: string;
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errorCount: number;
  errors: { row: number; message: string }[];
  createdAt: string;
}

export async function logImport(meta: {
  fileName: string;
  performedBy: string;
  totalRows: number;
  result: ImportResult;
}): Promise<void> {
  const uid = await requireUserId();
  await dbExt.from("prospect_imports").insert({
    user_id: uid,
    performed_by: meta.performedBy,
    file_name: meta.fileName,
    total_rows: meta.totalRows,
    inserted_count: meta.result.inserted,
    updated_count: meta.result.updated,
    skipped_count: meta.result.skipped,
    error_count: meta.result.errors.length,
    errors: meta.result.errors,
  });
}

export async function listImports(): Promise<ImportLog[]> {
  await requireUserId();
  const { data, error } = await dbExt.from("prospect_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    fileName: r.file_name,
    performedBy: r.performed_by,
    totalRows: r.total_rows,
    inserted: r.inserted_count,
    updated: r.updated_count,
    skipped: r.skipped_count,
    errorCount: r.error_count,
    errors: (r.errors as { row: number; message: string }[]) ?? [],
    createdAt: r.created_at,
  }));
}

export const EXPECTED_HEADERS = [
  "Nome Fantasia (ou Razão Social)",
  "CNPJ",
  "Telefone",
  "Atividade Principal - Texto (segmento)",
  "Municipio",
  "UF",
];
