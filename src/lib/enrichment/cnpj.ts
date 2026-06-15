import type { EnrichedProfile, EnrichedAddress } from "./types";

export function sanitizeCnpj(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function isValidCnpj(v: string): boolean {
  return sanitizeCnpj(v).length === 14;
}

interface BrasilApiResponse {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: { codigo: number; descricao: string }[];
  qsa?: { nome_socio: string; qualificacao_socio?: string }[];
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  email?: string;
}

function formatPhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return raw;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return raw;
}

export async function fetchCnpj(
  cnpj: string,
): Promise<{ profile: EnrichedProfile; address: EnrichedAddress }> {
  const clean = sanitizeCnpj(cnpj);
  if (clean.length !== 14) throw new Error("CNPJ inválido");
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
  if (!res.ok) throw new Error(`BrasilAPI ${res.status}`);
  const data = (await res.json()) as BrasilApiResponse;
  return {
    profile: {
      cnpj: clean,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      situacao: data.descricao_situacao_cadastral,
      data_abertura: data.data_inicio_atividade,
      natureza_juridica: data.natureza_juridica,
      porte: data.porte,
      capital_social: data.capital_social,
      cnae_principal: data.cnae_fiscal ? String(data.cnae_fiscal) : undefined,
      cnae_principal_desc: data.cnae_fiscal_descricao,
      cnaes_secundarios: (data.cnaes_secundarios ?? []).map((c) => ({
        codigo: String(c.codigo),
        descricao: c.descricao,
      })),
      socios: (data.qsa ?? []).map((s) => ({
        nome: s.nome_socio,
        qualificacao: s.qualificacao_socio,
      })),
      telefone_1: formatPhone(data.ddd_telefone_1),
      telefone_2: formatPhone(data.ddd_telefone_2),
      email: data.email?.toLowerCase(),
      raw: data,
    },
    address: {
      cep: data.cep,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.municipio,
      uf: data.uf,
    },
  };
}