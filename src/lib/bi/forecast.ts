// Period-aware forecast data — mirrors the Previsão card on /bi
import { supabase as sb } from "@/integrations/supabase/client";
import type { ResolvedPeriod } from "./period";
import { getForecastSettings } from "./forecast-settings";
import { localTimestamp } from "./tz";
import { fetchClientsAsContracts } from "./clients-source";
import { isGhostTable } from "./ghost-tables";

export interface ForecastBreakdown {
  recorrencia: number;       // MRR escalonado pela duração do período (em meses)
  fechado: number;           // Σ contract_value dos contratos assinados dentro do range
  pipelineAberto: number;    // Σ valor estimado de propostas em aberto (snapshot atual)
  pipelineProbabilidade: number; // Taxa aplicada (0–1)
  /** Origem da probabilidade aplicada — usado pela UI para explicar o número. */
  probabilidadeSource: "historico" | "fallback";
  /** Motivo curto quando caímos no fallback. */
  probabilidadeMotivo?: string;
  /** Amostra dos últimos 90 dias (independente do período selecionado). */
  amostra: {
    janelaDias: number;
    contratosRecentes: number;
    propostasRecentes: number;
    minimoAmostra: number;
    fallbackAplicado: number;
  };
}

type AnyRow = Record<string, unknown>;
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

async function safeSelect(table: string, cols: string): Promise<AnyRow[]> {
  if (isGhostTable(table)) return [];
  try {
    const { data, error } = await (sb as unknown as {
      from: (t: string) => { select: (c: string) => { limit: (n: number) => Promise<{ data: unknown; error: unknown }> } };
    }).from(table).select(cols).limit(5000);
    if (error) return [];
    return (data as AnyRow[]) ?? [];
  } catch {
    return [];
  }
}

function rowValue(r: AnyRow): number {
  return num(r.contract_value ?? r.value ?? r.valor_total ?? r.monthly_value);
}

function isActive(s: unknown): boolean {
  if (!s) return true;
  const v = String(s).toLowerCase();
  return v.includes("ativ") || v.includes("active") || v.includes("vigente") || v === "assinado";
}

function isOpenProposal(s: unknown): boolean {
  if (!s) return true;
  const v = String(s).toLowerCase();
  // tudo que não é fechado/ganho/perdido/cancelado conta como pipeline em aberto
  if (v.includes("assinad") || v.includes("ganh") || v.includes("won") || v.includes("aprov")) return false;
  if (v.includes("perd") || v.includes("lost") || v.includes("cancel") || v.includes("recus")) return false;
  return true;
}

function proposalValue(r: AnyRow): number {
  const mensal = num(r.valor_mensal);
  const implant = num(r.valor_implantacao);
  const avulso = num(r.valor_avulso);
  const total = mensal * 12 + implant + avulso;
  if (total > 0) return total;
  return num(r.contract_value ?? r.value ?? r.valor_total);
}

export async function fetchForecastForPeriod(period: ResolvedPeriod): Promise<ForecastBreakdown> {
  const settings = getForecastSettings();
  let contracts = await safeSelect("contracts", "monthly_value, contract_value, value, signed_at, status");
  if (contracts.length === 0) contracts = await safeSelect("op_contracts", "monthly_value, contract_value, signed_at, status");
  // Inclui lifecycle clients (Ficha 360°) para que edições em Operações
  // afetem Recorrência/Fechado em tempo real.
  contracts = [...contracts, ...((await fetchClientsAsContracts()) as unknown as AnyRow[])];

  const ativos = contracts.filter((r) => isActive(r.status));
  const mrr = ativos.reduce((a, r) => a + num(r.monthly_value), 0);
  // Recorrência proporcional ao tamanho do período (em meses, base 30 dias)
  const recorrencia = Math.round(mrr * (period.days / 30));

  const fromIso = localTimestamp(period.from);
  const toIso = localTimestamp(period.to);
  const fechado = Math.round(
    contracts
      .filter((r) => {
        const s = r.signed_at ? String(r.signed_at) : null;
        return s !== null && s >= fromIso && s <= toIso;
      })
      .reduce((a, r) => a + rowValue(r), 0),
  );

  // Pipeline (snapshot — propostas em aberto neste momento)
  let proposals = await safeSelect(
    "proposals",
    "status, valor_mensal, valor_implantacao, valor_avulso, contract_value, value, valor_total, created_at",
  );
  if (proposals.length === 0) {
    proposals = await safeSelect("op_proposals", "status, contract_value, value, valor_total, created_at");
  }
  const abertas = proposals.filter((r) => isOpenProposal(r.status));
  const pipelineAberto = Math.round(abertas.reduce((a, r) => a + proposalValue(r), 0));

  // Probabilidade histórica: contratos assinados nos últimos 90d / propostas criadas nos últimos 90d.
  // A janela é SEMPRE 90d (não muda com o filtro de período) para manter a probabilidade
  // estável entre Hoje/Semana/Mês/Trimestre. Quando a amostra é insuficiente, aplicamos
  // o fallback configurável e expomos o motivo para a UI exibir.
  const janelaDias = settings.windowDays;
  const minimoAmostra = settings.minSample;
  const fallback = settings.fallback;
  const since = localTimestamp(new Date(Date.now() - janelaDias * 86400000));
  const contratosRecentes = contracts.filter((r) => r.signed_at && String(r.signed_at) >= since).length;
  const propostasRecentes = proposals.filter((r) => r.created_at && String(r.created_at) >= since).length;

  let prob = fallback;
  let source: "historico" | "fallback" = "fallback";
  let motivo: string | undefined;

  if (propostasRecentes === 0) {
    motivo = `Sem propostas criadas nos últimos ${janelaDias} dias — usando fallback configurado.`;
  } else if (propostasRecentes < minimoAmostra) {
    motivo = `Amostra insuficiente (${propostasRecentes}/${minimoAmostra} propostas em ${janelaDias} d) — usando fallback configurado.`;
  } else {
    const taxa = contratosRecentes / propostasRecentes;
    if (!Number.isFinite(taxa) || taxa <= 0) {
      motivo = `Nenhum contrato fechado nos últimos ${janelaDias} dias — usando fallback configurado.`;
    } else {
      prob = Math.min(1, taxa);
      source = "historico";
    }
  }

  return {
    recorrencia,
    fechado,
    pipelineAberto,
    pipelineProbabilidade: Math.round(prob * 100) / 100,
    probabilidadeSource: source,
    probabilidadeMotivo: motivo,
    amostra: {
      janelaDias,
      contratosRecentes,
      propostasRecentes,
      minimoAmostra,
      fallbackAplicado: fallback,
    },
  };
}
