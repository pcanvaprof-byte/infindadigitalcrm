// Reads `clients` (lifecycle) and maps them into a ContractRow-like shape
// so BI panels (Diretoria/Forecast/Charts/Today) reflect updates made in
// Operações → Ficha 360° even when no row exists in `contracts`/`op_contracts`.
import { supabase as sb } from "@/integrations/supabase/client";

export type ClientContractLike = {
  monthly_value: number | null;
  contract_value: number | null;
  value: number | null;
  signed_at: string | null;
  status: string | null;
  source: "clients";
};

const ACTIVE_STAGES = new Set([
  "PAGAMENTO_CONFIRMADO",
  "IMPLANTACAO",
  "ATIVO",
]);

type Row = {
  mensalidade?: number | null;
  site_recurring_value?: number | null;
  site_one_time_value?: number | null;
  permuta_value?: number | null;
  contract_term_months?: number | null;
  pipeline_stage?: string | null;
  activated_at?: string | null;
  created_at?: string | null;
};

let cache: { at: number; data: ClientContractLike[] } | null = null;
const TTL_MS = 30_000;

export async function fetchClientsAsContracts(): Promise<ClientContractLike[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const { data, error } = await sb
      .from("clients" as never)
      .select(
        "mensalidade, site_recurring_value, site_one_time_value, permuta_value, contract_term_months, pipeline_stage, activated_at, created_at",
      )
      .limit(5000);
    if (error) {
      cache = { at: Date.now(), data: [] };
      return [];
    }
    const rows = ((data ?? []) as unknown as Row[]).map<ClientContractLike>((c) => {
      const monthly =
        Number(c.mensalidade ?? 0) + Number(c.site_recurring_value ?? 0);
      const term = Number(c.contract_term_months ?? 12) || 12;
      const oneTime =
        Number(c.site_one_time_value ?? 0) + Number(c.permuta_value ?? 0);
      const total = monthly * term + oneTime;
      const stage = String(c.pipeline_stage ?? "").toUpperCase();
      const active = ACTIVE_STAGES.has(stage);
      return {
        monthly_value: monthly > 0 ? monthly : null,
        contract_value: total > 0 ? total : null,
        value: total > 0 ? total : null,
        signed_at: c.activated_at ?? c.created_at ?? null,
        status: active ? "ativo" : stage.toLowerCase() || "inativo",
        source: "clients",
      };
    });
    cache = { at: Date.now(), data: rows };
    return rows;
  } catch {
    return [];
  }
}

export function invalidateClientsAsContractsCache(): void {
  cache = null;
}