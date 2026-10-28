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
  try {
    const PAGE = 2000;
    const page0Res = await db
      .from("company_profiles")
      .select("cnpj,data_abertura,cnae_principal_desc", { count: "exact" })
      .range(0, PAGE - 1);

    if (page0Res.error) return out;
    const allRows = (page0Res.data ?? []) as Array<{
      cnpj: string | null;
      data_abertura: string | null;
      cnae_principal_desc: string | null;
    }>;

    const total = page0Res.count ?? allRows.length;

    if (total > PAGE) {
      const totalPages = Math.ceil(total / PAGE);
      const remainingIndices: number[] = [];
      for (let i = 1; i < totalPages; i++) {
        remainingIndices.push(i);
      }
      const CONCURRENCY = 4;
      for (let i = 0; i < remainingIndices.length; i += CONCURRENCY) {
        const chunk = remainingIndices.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(
          chunk.map(async (pageIdx) => {
            const from = pageIdx * PAGE;
            const { data, error } = await db
              .from("company_profiles")
              .select("cnpj,data_abertura,cnae_principal_desc")
              .range(from, from + PAGE - 1);
            if (error) return [];
            return (data ?? []) as Array<{
              cnpj: string | null;
              data_abertura: string | null;
              cnae_principal_desc: string | null;
            }>;
          }),
        );
        for (const batch of chunkResults) {
          allRows.push(...batch);
        }
      }
    }

    for (const r of allRows) {
      const key = (r.cnpj ?? "").replace(/\D/g, "");
      if (!key) continue;
      const prev = out[key];
      if (!prev?.data_abertura) {
        out[key] = { data_abertura: r.data_abertura, cnae_principal_desc: r.cnae_principal_desc };
      }
    }
  } catch (e) {
    console.warn("loadOpeningByCnpj error:", e);
  }
  return out;
}

export const openingKeys = { all: ["enrichment", "opening-map"] as const };
