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
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  company_addresses: {
    logradouro: string | null; numero: string | null; bairro: string | null;
    cidade: string | null; uf: string | null; cep: string | null;
  }[] | null;
  company_locations: { lat: number | null; lon: number | null }[] | null;
};

type ProspectRow = {
  cnpj: string | null; company: string; whatsapp: string | null;
  phone: string | null; email: string | null; status: string | null;
  potential: string | null; city: string | null; state: string | null;
};

export async function loadMapPoints(): Promise<MapPoint[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const [profilesRes, prospectsRes] = await Promise.all([
    db
      .from("company_profiles")
      .select("cnpj,razao_social,nome_fantasia,company_addresses(logradouro,numero,bairro,cidade,uf,cep),company_locations(lat,lon)")
      .eq("user_id", uid),
    db
      .from("prospects")
      .select("cnpj,company,whatsapp,phone,email,status,potential,city,state")
      .eq("user_id", uid),
  ]);

  const profiles = (profilesRes.data ?? []) as unknown as ProfileRow[];
  const prospects = (prospectsRes.data ?? []) as unknown as ProspectRow[];

  const profByCnpj = new Map<string, ProfileRow>();
  for (const p of profiles) if (p.cnpj) profByCnpj.set(p.cnpj.replace(/\D/g, ""), p);

  return prospects
    .filter((p) => p.cnpj && p.cnpj.replace(/\D/g, "").length === 14)
    .map((p): MapPoint => {
      const clean = p.cnpj!.replace(/\D/g, "");
      const prof = profByCnpj.get(clean);
      const addr = prof?.company_addresses?.[0];
      const loc = prof?.company_locations?.[0];
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