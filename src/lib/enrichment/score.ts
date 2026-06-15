import type {
  EnrichedProfile,
  EnrichedLocation,
  MarketData,
  ScoreResult,
  ScoreBreakdown,
} from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function tempoMercado(abertura?: string): number {
  if (!abertura) return 0;
  const d = new Date(abertura);
  if (Number.isNaN(d.getTime())) return 0;
  const anos = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (anos <= 0) return 0;
  if (anos >= 20) return 100;
  return Math.round((anos / 20) * 100);
}

function porteScore(porte?: string): number {
  const p = (porte || "").toUpperCase();
  if (p.includes("DEMAIS") || p.includes("GRANDE")) return 100;
  if (p.includes("MÉDIO") || p.includes("MEDIO")) return 75;
  if (p.includes("EPP") || p.includes("PEQUENO")) return 55;
  if (p.includes("ME") || p.includes("MICRO")) return 35;
  return 20;
}

function capitalScore(cap?: number): number {
  if (!cap || cap <= 0) return 0;
  if (cap >= 5_000_000) return 100;
  if (cap >= 1_000_000) return 85;
  if (cap >= 500_000) return 70;
  if (cap >= 100_000) return 55;
  if (cap >= 50_000) return 40;
  if (cap >= 10_000) return 25;
  return 10;
}

export function marketScore(m?: MarketData | null): number {
  if (!m) return 0;
  let pop = 0;
  if (m.populacao) {
    if (m.populacao >= 1_000_000) pop = 100;
    else if (m.populacao >= 500_000) pop = 85;
    else if (m.populacao >= 200_000) pop = 70;
    else if (m.populacao >= 100_000) pop = 55;
    else if (m.populacao >= 50_000) pop = 40;
    else if (m.populacao >= 20_000) pop = 25;
    else pop = 15;
  }
  let pibpc = 0;
  if (m.pib_per_capita) {
    if (m.pib_per_capita >= 80_000) pibpc = 100;
    else if (m.pib_per_capita >= 50_000) pibpc = 80;
    else if (m.pib_per_capita >= 30_000) pibpc = 60;
    else if (m.pib_per_capita >= 20_000) pibpc = 45;
    else if (m.pib_per_capita >= 10_000) pibpc = 30;
    else pibpc = 15;
  }
  const w = pop && pibpc ? Math.round(pop * 0.6 + pibpc * 0.4) : pop || pibpc;
  return clamp(w);
}

function presencaDigital(p: EnrichedProfile, hasLocation: boolean): number {
  let s = 0;
  if (p.nome_fantasia) s += 25;
  if (p.razao_social) s += 15;
  if (hasLocation) s += 30;
  if ((p.cnaes_secundarios?.length ?? 0) > 0) s += 15;
  if ((p.socios?.length ?? 0) > 0) s += 15;
  return clamp(s);
}

function historicoScore(p: EnrichedProfile): number {
  const sit = (p.situacao || "").toUpperCase();
  if (sit.includes("ATIVA")) return 90;
  if (sit.includes("SUSPEN")) return 35;
  if (sit.includes("INAPTA")) return 20;
  if (sit.includes("BAIXAD")) return 0;
  return 50;
}

const WEIGHTS = { tempo: 1, porte: 2, capital: 3, regiao: 4, digital: 5, hist: 6 };

export function computeScore(
  profile: EnrichedProfile,
  market?: MarketData | null,
  location?: EnrichedLocation | null,
): ScoreResult {
  const breakdown: ScoreBreakdown = {
    tempo_mercado: tempoMercado(profile.data_abertura),
    porte: porteScore(profile.porte),
    capital: capitalScore(profile.capital_social),
    potencial_regiao: marketScore(market),
    presenca_digital: presencaDigital(profile, !!location),
    historico: historicoScore(profile),
  };
  const totalW =
    WEIGHTS.tempo + WEIGHTS.porte + WEIGHTS.capital + WEIGHTS.regiao + WEIGHTS.digital + WEIGHTS.hist;
  const lead = Math.round(
    (breakdown.tempo_mercado * WEIGHTS.tempo +
      breakdown.porte * WEIGHTS.porte +
      breakdown.capital * WEIGHTS.capital +
      breakdown.potencial_regiao * WEIGHTS.regiao +
      breakdown.presenca_digital * WEIGHTS.digital +
      breakdown.historico * WEIGHTS.hist) /
      totalW,
  );
  const lead_score = clamp(lead);
  const market_score = breakdown.potencial_regiao;
  let classificacao: ScoreResult["classificacao"] = "Frio";
  if (lead_score >= 76) classificacao = "Muito Quente";
  else if (lead_score >= 51) classificacao = "Quente";
  else if (lead_score >= 26) classificacao = "Morno";
  return { lead_score, market_score, classificacao, breakdown };
}

export const CLASS_TONE: Record<ScoreResult["classificacao"], string> = {
  Frio: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  Morno: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Quente: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  "Muito Quente": "bg-rose-500/15 text-rose-300 border-rose-500/40",
};