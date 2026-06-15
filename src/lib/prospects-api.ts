import { supabase } from "@/integrations/supabase/client";
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
};

type IxRow = {
  id: string;
  prospect_id: string;
  kind: string;
  text: string;
  by_name: string;
  created_at: string;
};

function fromRow(r: Row, ixs: IxRow[] = []): Prospect {
  return {
    id: r.id,
    company: r.company,
    cnpj: r.cnpj ?? undefined,
    segment: r.segment,
    owner: r.owner_name,
    whatsapp: r.whatsapp,
    phone: r.phone,
    email: r.email,
    instagram: r.instagram,
    city: r.city,
    state: r.state,
    source: r.source,
    potential: r.potential as ProspectPotential,
    status: r.status as ProspectStatus,
    createdAt: new Date(r.created_at).toLocaleString("pt-BR"),
    interactions: ixs
      .filter((i) => i.prospect_id === r.id)
      .map((i) => ({
        id: i.id,
        kind: i.kind as InteractionKind,
        text: i.text,
        by: i.by_name,
        at: new Date(i.created_at).toLocaleString("pt-BR"),
      })),
  };
}

export async function loadAllProspects(): Promise<Prospect[]> {
  const { data: rows, error } = await supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.id);
  let ixs: IxRow[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("prospect_interactions")
      .select("*")
      .in("prospect_id", ids)
      .order("created_at", { ascending: false });
    ixs = (data ?? []) as IxRow[];
  }
  return (rows ?? []).map((r) => fromRow(r as Row, ixs));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function insertProspect(p: Omit<Prospect, "id" | "createdAt" | "interactions">) {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sessão expirou — entre novamente.");
  const { data, error } = await supabase
    .from("prospects")
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
  if (patch.status !== undefined) map.status = patch.status;
  const { error } = await supabase.from("prospects").update(map as never).eq("id", id);
  if (error) throw error;
}

export async function deleteProspects(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from("prospects").delete().in("id", ids);
  if (error) throw error;
}

export async function addInteractionRemote(
  prospectId: string,
  kind: InteractionKind,
  text: string,
  byName: string,
): Promise<Interaction | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("prospect_interactions")
    .insert({ prospect_id: prospectId, user_id: uid, kind, text, by_name: byName })
    .select()
    .single();
  if (error) {
    console.warn("addInteraction error", error);
    return null;
  }
  const r = data as IxRow;
  return {
    id: r.id,
    kind: r.kind as InteractionKind,
    text: r.text,
    by: r.by_name,
    at: new Date(r.created_at).toLocaleString("pt-BR"),
  };
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
}

/**
 * Insere novos e atualiza (somente campos vazios do existente) por CNPJ.
 */
export async function applyImport(
  rows: PreviewRow[],
  existing: Prospect[],
): Promise<ImportResult> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sessão expirou — entre novamente.");

  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const byCnpj = new Map<string, Prospect>();
  for (const e of existing) if (e.cnpj) byCnpj.set(e.cnpj, e);

  const toInsert: Record<string, unknown>[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  for (const r of rows) {
    if (r.errors.length) {
      result.errors.push({ row: r.rowIndex, message: r.errors.join(" | ") });
      result.skipped++;
      continue;
    }
    const cnpj = r.data.cnpj || "";
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

  if (toInsert.length) {
    const { error, count } = await supabase
      .from("prospects")
      .insert(toInsert as never, { count: "exact" });
    if (error) {
      result.errors.push({ row: 0, message: `Inserção: ${error.message}` });
    } else {
      result.inserted = count ?? toInsert.length;
    }
  }

  for (const u of updates) {
    const { error } = await supabase.from("prospects").update(u.patch as never).eq("id", u.id);
    if (error) result.errors.push({ row: 0, message: `Atualização ${u.id}: ${error.message}` });
    else result.updated++;
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
  const uid = await currentUserId();
  if (!uid) return;
  await supabase.from("prospect_imports").insert({
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
  const { data, error } = await supabase
    .from("prospect_imports")
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
    createdAt: new Date(r.created_at).toLocaleString("pt-BR"),
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
