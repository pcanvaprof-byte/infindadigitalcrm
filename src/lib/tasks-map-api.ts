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
    fetchAll<ProspectRow>((from, to) =>
      db.from("v_prospects_with_state")
        .select("cnpj,company,whatsapp,phone,email,status,potential,city,state")
        .range(from, to),
    ),
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

export function bairroColor(bairro?: string | null): string {
  const s = (bairro || "Sem bairro").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 75% 55%)`;
}