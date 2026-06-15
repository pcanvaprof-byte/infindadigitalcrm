export interface EnrichedProfile {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao?: string;
  data_abertura?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  cnae_principal?: string;
  cnae_principal_desc?: string;
  cnaes_secundarios?: { codigo: string; descricao: string }[];
  socios?: { nome: string; qualificacao?: string }[];
  raw?: unknown;
}

export interface EnrichedAddress {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  regiao?: string;
}

export interface EnrichedLocation {
  lat: number;
  lon: number;
  display_name?: string;
}

export interface MarketData {
  municipio_ibge_id?: string;
  cidade?: string;
  uf?: string;
  populacao?: number;
  pib_total?: number;
  pib_per_capita?: number;
  idh?: number;
}

export interface ScoreBreakdown {
  tempo_mercado: number;
  porte: number;
  capital: number;
  potencial_regiao: number;
  presenca_digital: number;
  historico: number;
}

export interface ScoreResult {
  lead_score: number;
  market_score: number;
  classificacao: "Frio" | "Morno" | "Quente" | "Muito Quente";
  breakdown: ScoreBreakdown;
}

export type EnrichmentStep =
  | "cnpj"
  | "cep"
  | "geo"
  | "ibge"
  | "score"
  | "persist";

export interface EnrichmentResult {
  profile: EnrichedProfile;
  address?: EnrichedAddress;
  location?: EnrichedLocation;
  market?: MarketData;
  score: ScoreResult;
}