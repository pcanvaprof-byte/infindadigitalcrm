import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const PAGE = 1000;

export interface OpeningInfo {
  data_abertura: string | null;
  cnae_principal_desc: string | null;
}

/** Mapa CNPJ (14 dígitos) → data de abertura / CNAE, vindo do enriquecimento. */
export async function loadOpeningByCnpj(): Promise<Record<string, OpeningInfo>> {
  const out: Record<string, OpeningInfo> = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("company_profiles")
      .select("cnpj,data_abertura,cnae_principal_desc")
      .range(from, from + PAGE - 1);
    if (error) break;
    const rows = (data ?? []) as { cnpj: string | null; data_abertura: string | null; cnae_principal_desc: string | null }[];
    for (const r of rows) {
      const key = (r.cnpj ?? "").replace(/\D/g, "");
      if (!key) continue;
      const prev = out[key];
      if (!prev?.data_abertura) {
        out[key] = { data_abertura: r.data_abertura, cnae_principal_desc: r.cnae_principal_desc };
      }
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

export const openingKeys = { all: ["enrichment", "opening-map"] as const };
