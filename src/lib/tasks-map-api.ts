import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface MapPoint {
  cnpj: string;
  company: string;
  fantasia?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  cep?: string | null;
  lat?: number | null;
  lon?: number | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  potential?: string | null;
  nicho?: string | null;
  data_abertura?: string | null;
}

type ProfileRow = {
  id: string;
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  data_abertura: string | null;
};
type AddrRow = {
  profile_id: string;
  logradouro: string | null; numero: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null;
};
type LocRow = { profile_id: string; lat: number | null; lon: number | null };

type ProspectRow = {
  id: string;
  cnpj: string | null; company: string; whatsapp: string | null;
  phone: string | null; email: string | null; status: string | null;
  potential: string | null; city: string | null; state: string | null;
  nicho: string | null;
  merged_into: string | null;
};

type DbErrorLike = { code?: string; message?: string };

const PROSPECTS_BATCH = 100;
const PAGE = 1000;

async function fetchByIds<T>(
  ids: string[],
  build: (slice: string[], from: number, to: number) => Promise<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  const ID_BATCH = 200;
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const slice = ids.slice(i, i + ID_BATCH);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build(slice, from, from + PAGE - 1);
      if (error) throw error;
      const batch = (data ?? []) as T[];
      out.push(...batch);
      if (batch.length < PAGE) break;
    }
  }
  return out;
}

/**
 * Carrega metadados (perfis, endereços, locais) para uma lista de prospects.
 */
async function hydrateMapPoints(prospects: ProspectRow[], uid: string): Promise<MapPoint[]> {
  const prospectCnpjs = new Set<string>();
  for (const p of prospects) {
    if (p.cnpj) prospectCnpjs.add(p.cnpj.replace(/\D/g, ""));
  }

  const cnpjList = Array.from(prospectCnpjs);
  if (cnpjList.length === 0) return [];

  console.log(`[MAPA] Buscando perfis e status para ${cnpjList.length} CNPJs`);
  const [profilesResult, states] = await Promise.allSettled([
    fetchByIds<ProfileRow>(cnpjList, (slice, from, to) =>
      db.from("company_profiles")
        .select("id,cnpj,razao_social,nome_fantasia,data_abertura")
        .in("cnpj", slice)
        .range(from, to),
    ),
    fetchUserLeadStatuses(uid, prospects.map(p => p.id))
  ]);

  const profiles = profilesResult.status === 'fulfilled' ? profilesResult.value : [];
  if (profilesResult.status === 'rejected') {
    console.error("[MAPA] Erro ao buscar perfis:", profilesResult.reason);
  }
  
  const leadStatuses = states.status === 'fulfilled' ? states.value : new Map<string, string>();
  if (states.status === 'rejected') {
    console.error("[MAPA] Erro ao buscar status:", states.reason);
  }

  console.log(`[MAPA] ${profiles.length} perfis encontrados`);

  const profileIds = profiles.map((p) => p.id);
  const [addrs, locs] = profileIds.length
    ? await Promise.all([
        fetchByIds<AddrRow>(profileIds, (slice, from, to) =>
          db.from("company_addresses")
            .select("profile_id,logradouro,numero,bairro,cidade,uf,cep")
            .in("profile_id", slice)
            .range(from, to),
        ),
        fetchByIds<LocRow>(profileIds, (slice, from, to) =>
          db.from("company_locations")
            .select("profile_id,lat,lon")
            .in("profile_id", slice)
            .range(from, to),
        ),
      ])
    : [[], []];

  const addrByProf = new Map<string, AddrRow>();
  for (const a of addrs) addrByProf.set(a.profile_id, a);
  const locByProf = new Map<string, LocRow>();
  for (const l of locs) locByProf.set(l.profile_id, l);

  const profByCnpj = new Map<string, ProfileRow>();
  const richness = (p: ProfileRow) =>
    (locByProf.has(p.id) ? 2 : 0) + (addrByProf.has(p.id) ? 1 : 0);
  for (const p of profiles) {
    if (!p.cnpj) continue;
    const key = p.cnpj.replace(/\D/g, "");
    const current = profByCnpj.get(key);
    if (!current || richness(p) > richness(current)) profByCnpj.set(key, p);
  }

  const out: MapPoint[] = [];
  for (const p of prospects) {
    const clean = (p.cnpj || "").replace(/\D/g, "");
    const prof = clean ? profByCnpj.get(clean) : undefined;
    const addr = prof ? addrByProf.get(prof.id) : undefined;
    const loc = prof ? locByProf.get(prof.id) : undefined;

    // Se não tiver localização E nem endereço E nem cidade no prospect, não conseguimos mostrar no mapa
    if (!loc?.lat && !loc?.lon && !addr?.logradouro && !p.city) {
      continue;
    }

    out.push({
      cnpj: clean || `no-cnpj-${p.id}`,
      company: prof?.nome_fantasia || prof?.razao_social || p.company,
      fantasia: prof?.nome_fantasia ?? null,
      bairro: addr?.bairro ?? null,
      cidade: addr?.cidade ?? p.city ?? null,
      uf: addr?.uf ?? p.state ?? null,
      logradouro: addr?.logradouro ?? null,
      numero: addr?.numero ?? null,
      cep: addr?.cep ?? null,
      lat: loc?.lat ?? null,
      lon: loc?.lon ?? null,
      whatsapp: p.whatsapp,
      phone: p.phone,
      email: p.email,
      status: leadStatuses.get(p.id) ?? "nao_contatado",
      potential: p.potential,
      nicho: p.nicho,
      data_abertura: prof?.data_abertura ?? null,
    });
  }
  return out;
}

export interface MapLoaderState {
  points: MapPoint[];
  loading: boolean;
  totalLoaded: number;
  totalExpected: number | null;
  error: Error | null;
  isComplete: boolean;
}

/**
 * Hook or generator for progressive map loading.
 * Returns batches of MapPoints to be merged by the caller.
 */
export async function* loadMapPointsProgressive(): AsyncGenerator<{ points: MapPoint[], totalExpected: number }> {
  console.log("[MAPA] Iniciando loadMapPointsProgressive");
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) {
    console.error("[MAPA] Usuário não autenticado");
    return;
  }

  // 1. Get total count
  console.log("[MAPA] Buscando total de prospects");
  const { count, error: countError } = await db.from("prospects")
    .select("*", { count: "exact", head: true })
    .is("merged_into", null);
  
  const total = count ?? 0;
  if (countError && (countError as any).code !== "42703") {
    console.error("[MAPA] Erro ao buscar contagem:", countError);
    throw countError;
  }
  console.log(`[MAPA] Total esperado: ${total}`);

  // 2. Fetch in batches
  const seenCnpjs = new Set<string>();

  for (let from = 0; ; from += PROSPECTS_BATCH) {
    const to = from + PROSPECTS_BATCH - 1;
    console.log(`[MAPA] Buscando lote de prospects: ${from} a ${to}`);
    
    // Fetch prospects
    let { data: prospects, error } = await db.from("prospects")
      .select("id,cnpj,company,whatsapp,phone,email,potential,city,state,segment,merged_into")
      .is("merged_into", null)
      .range(from, to);

    if (error && (error as any).code === "42703") {
      console.warn("[MAPA] Coluna merged_into ausente, tentando sem ela");
      const res = await db.from("prospects")
        .select("id,cnpj,company,whatsapp,phone,email,potential,city,state,segment")
        .range(from, to);
      prospects = res.data;
      error = res.error;
    }

    if (error) {
      console.error(`[MAPA] Erro ao buscar lote ${from}-${to}:`, error);
      throw error;
    }
    
    if (!prospects || prospects.length === 0) {
      console.log(`[MAPA] Nenhum prospect retornado no lote ${from}-${to}. Encerrando.`);
      break;
    }

    console.log(`[MAPA] Lote ${from}-${to} recebido: ${prospects.length} prospects`);
    const rows = prospects as ProspectRow[];
    
    // Filter out locally
    const uniqueRows = rows.filter(r => {
      const clean = (r.cnpj || "").replace(/\D/g, "");
      if (clean && seenCnpjs.has(clean)) return false;
      if (clean) seenCnpjs.add(clean);
      return true;
    });

    console.log(`[MAPA] Prospects únicos no lote: ${uniqueRows.length}`);

    if (uniqueRows.length > 0) {
      console.log(`[MAPA] Hidratando ${uniqueRows.length} prospects...`);
      try {
        const hydrated = await hydrateMapPoints(uniqueRows, uid);
        console.log(`[MAPA] Hidratação concluída: ${hydrated.length} pontos válidos`);
        yield { points: hydrated, totalExpected: total };
      } catch (hydrationError) {
        console.error("[MAPA] Erro durante a hidratação do lote:", hydrationError);
        // Não deixamos o erro de um lote quebrar a sequência
      }
    } else {
      console.log("[MAPA] Nenhuma linha única no lote, pulando hidratação");
    }

    if (prospects.length < PROSPECTS_BATCH) {
      console.log("[MAPA] Fim da base alcançado.");
      break;
    }
  }
}

async function fetchUserLeadStatuses(uid: string, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  try {
    const states = await fetchByIds<{ prospect_id: string; tipo: string | null; resultado: string | null; mensagem: string | null }>(ids, (slice, from, to) =>
      db.from("prospect_touchpoints")
        .select("prospect_id,tipo,resultado,mensagem,enviado_em")
        .eq("user_id", uid)
        .in("prospect_id", slice)
        .in("tipo", ["status", "whatsapp", "ligacao", "email", "reuniao", "resposta"])
        .order("enviado_em", { ascending: false })
        .range(from, to),
    );
    for (const state of states) {
      if (out.has(state.prospect_id)) continue;
      if (state.tipo === "status") {
        out.set(state.prospect_id, normalizeProspectStatus(state.resultado) ?? normalizeProspectStatus(state.mensagem) ?? "nao_contatado");
      } else if (state.tipo === "resposta" || state.resultado === "respondido" || state.resultado === "interessado") {
        out.set(state.prospect_id, "qualificado");
      } else {
        out.set(state.prospect_id, "primeiro_contato");
      }
    }
  } catch (error) {
    if (!isMissingRelation(error)) console.warn("loadMapPoints touchpoints status fallback error", error);
  }
  return out;
}

function normalizeProspectStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  const status = value.trim().replace(/^status\s*:\s*/i, "");
  return [
    "nao_contatado", "primeiro_contato", "em_negociacao", "qualificado", "agendado", "perdido",
    "briefing_enviado", "diagnostico_pendente", "proposta_pendente", "proposta_enviada", "fechado_ganho",
    "aguardando_kickoff", "aguardando_producao", "em_producao", "entregue", "cliente",
  ].includes(status) ? status : null;
}

function isMissingRelation(error: unknown): boolean {
  const err = error as DbErrorLike;
  return err?.code === "PGRST205" || /schema cache|Could not find the table|does not exist/i.test(err?.message ?? "");
}

export function bairroColor(bairro?: string | null): string {
  const s = (bairro || "Sem bairro").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 75% 55%)`;
}

/* ---------- Cache offline dos pontos do mapa (uso em campo) ---------- */

const POINTS_CACHE = "pap.map.points.v1";

export function readMapCacheInfo() {
  const cached = readPointsCache();
  return {
    count: cached.length,
    limit: 5000,
    isTruncated: cached.length >= 5000
  };
}

function readPointsCache(): MapPoint[] {
  try {
    return JSON.parse(localStorage.getItem(POINTS_CACHE) || "[]") as MapPoint[];
  } catch {
    return [];
  }
}

function writePointsCache(points: MapPoint[]) {
  try {
    localStorage.setItem(POINTS_CACHE, JSON.stringify(points.slice(0, 5000)));
  } catch {
    /* quota — ignora */
  }
}

/**
 * Versão legada para compatibilidade se necessário, mas deve ser evitada
 * para grandes volumes em favor da carga progressiva.
 */
export async function loadMapPoints(): Promise<MapPoint[]> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) {
    const cached = readPointsCache();
    if (cached.length) return cached;
  }
  
  const all: MapPoint[] = [];
  try {
    for await (const batch of loadMapPointsProgressive()) {
      all.push(...batch.points);
    }
    writePointsCache(all);
    return all;
  } catch (e) {
    const cached = readPointsCache();
    if (cached.length) return cached;
    throw e;
  }
}
