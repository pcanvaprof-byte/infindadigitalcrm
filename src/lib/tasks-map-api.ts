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
}

type ProfileRow = {
  id: string;
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
};
type AddrRow = {
  profile_id: string;
  logradouro: string | null; numero: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null;
};
type LocRow = { profile_id: string; lat: number | null; lon: number | null };

type ProspectRow = {
  cnpj: string | null; company: string; whatsapp: string | null;
  phone: string | null; email: string | null; status: string | null;
  potential: string | null; city: string | null; state: string | null;
};

type UserLeadStateRow = { prospect_id: string; status: string | null };

type DbErrorLike = { code?: string; message?: string };

const PAGE = 1000;

async function fetchAll<T>(
  build: (from: number, to: number) => Promise<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

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

export async function loadMapPoints(): Promise<MapPoint[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const [profiles, prospects] = await Promise.all([
    fetchAll<ProfileRow>((from, to) =>
      db.from("company_profiles")
        .select("id,cnpj,razao_social,nome_fantasia")
        .eq("user_id", uid)
        .range(from, to),
    ),
    loadMapProspects(uid),
  ]);
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
    : [[] as AddrRow[], [] as LocRow[]];
  const addrByProf = new Map<string, AddrRow>();
  for (const a of addrs) addrByProf.set(a.profile_id, a);
  const locByProf = new Map<string, LocRow>();
  for (const l of locs) locByProf.set(l.profile_id, l);

  const profByCnpj = new Map<string, ProfileRow>();
  for (const p of profiles) if (p.cnpj) profByCnpj.set(p.cnpj.replace(/\D/g, ""), p);

  return prospects
    .filter((p) => p.cnpj && p.cnpj.replace(/\D/g, "").length === 14)
    .map((p): MapPoint => {
      const clean = p.cnpj!.replace(/\D/g, "");
      const prof = profByCnpj.get(clean);
      const addr = prof ? addrByProf.get(prof.id) : undefined;
      const loc = prof ? locByProf.get(prof.id) : undefined;
      return {
        cnpj: clean,
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
        status: p.status,
        potential: p.potential,
      };
    });
}

async function loadMapProspects(uid: string): Promise<ProspectRow[]> {
  try {
    return await fetchAll<ProspectRow>((from, to) =>
      // v_prospects_user: 'status' privado por usuário (Fase 2 isolamento).
      db.from("v_prospects_user" as never)
        .select("cnpj,company,whatsapp,phone,email,status,potential,city,state")
        .range(from, to),
    );
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    console.warn("v_prospects_user indisponível no mapa; usando fallback seguro", error);
  }

  const rows = await fetchAll<ProspectRow & { id: string }>((from, to) =>
    db.from("prospects")
      .select("id,cnpj,company,whatsapp,phone,email,potential,city,state")
      .range(from, to),
  );

  const states = await fetchUserLeadStatuses(uid, rows.map((r) => r.id));
  return rows.map((row) => ({
    cnpj: row.cnpj,
    company: row.company,
    whatsapp: row.whatsapp,
    phone: row.phone,
    email: row.email,
    status: states.get(row.id) ?? "nao_contatado",
    potential: row.potential,
    city: row.city,
    state: row.state,
  }));
}

async function fetchUserLeadStatuses(uid: string, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  try {
    const states = await fetchByIds<UserLeadStateRow>(ids, (slice, from, to) =>
      db.from("user_lead_state")
        .select("prospect_id,status")
        .eq("user_id", uid)
        .in("prospect_id", slice)
        .range(from, to),
    );
    for (const state of states) out.set(state.prospect_id, state.status ?? "nao_contatado");
  } catch (error) {
    if (!isMissingRelation(error)) console.warn("loadMapPoints user_lead_state fallback error", error);
  }
  return out;
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