import { supabase as sb } from "@/integrations/supabase/client";

/**
 * KPIs essenciais da aba Diretoria, calculados client-side a partir
 * das tabelas base — usado como fallback quando a RPC bi_dashboard falha
 * (ex.: erro "column 'empresa' does not exist") ou retorna vazio.
 *
 * Sem schema novo, sem alterar lógica existente: apenas leitura defensiva.
 */
export interface DiretoriaKpis {
  receita_realizada: number; // soma assinada no mês corrente
  mrr: number;               // soma de monthly_value dos contratos ativos
  arr: number;               // mrr * 12
  ticket_medio: number;      // média do valor de contrato
  clientes_ativos: number;
}

function startOfMonthIso(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

type ContractRow = {
  monthly_value?: number | null;
  contract_value?: number | null;
  value?: number | null;
  signed_at?: string | null;
  status?: string | null;
};

async function safeSelect(table: string, columns: string): Promise<ContractRow[] | null> {
  try {
    const { data, error } = await sb.from(table as never).select(columns).limit(5000);
    if (error) return null;
    return (data ?? []) as unknown as ContractRow[];
  } catch {
    return null;
  }
}

export async function fetchDiretoriaKpis(): Promise<DiretoriaKpis> {
  // Tenta primeiro a tabela canônica `contracts`, depois `op_contracts`.
  let rows = await safeSelect("contracts", "monthly_value, contract_value, value, signed_at, status");
  if (!rows) rows = await safeSelect("op_contracts", "monthly_value, contract_value, signed_at, status");
  if (!rows) rows = [];

  const ini = startOfMonthIso();
  const isActive = (s?: string | null) => {
    if (!s) return true; // sem coluna status → assume ativo
    const v = s.toLowerCase();
    return v.includes("ativ") || v.includes("active") || v.includes("vigente") || v === "assinado";
  };

  const ativos = rows.filter((r) => isActive(r.status));
  const mrr = ativos.reduce((a, r) => a + Number(r.monthly_value ?? 0), 0);
  const valores = ativos
    .map((r) => Number(r.contract_value ?? r.value ?? r.monthly_value ?? 0))
    .filter((n) => n > 0);
  const ticketMedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

  const receitaRealizada = rows
    .filter((r) => r.signed_at && r.signed_at >= ini)
    .reduce((a, r) => a + Number(r.contract_value ?? r.value ?? r.monthly_value ?? 0), 0);

  return {
    receita_realizada: Math.round(receitaRealizada),
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    ticket_medio: Math.round(ticketMedio),
    clientes_ativos: ativos.length,
  };
}