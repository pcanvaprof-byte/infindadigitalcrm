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

interface PublicaCnpjWsResponse {
  razao_social?: string;
  capital_social?: string | number;
  porte?: { descricao?: string };
  natureza_juridica?: { descricao?: string };
  socios?: { nome?: string; qualificacao_socio?: { descricao?: string } }[];
  estabelecimento?: {
    nome_fantasia?: string;
    situacao_cadastral?: string;
    data_inicio_atividade?: string;
    atividade_principal?: { id?: string | number; descricao?: string };
    atividades_secundarias?: { id?: string | number; descricao?: string }[];
    cep?: string;
    tipo_logradouro?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: { nome?: string };
    estado?: { sigla?: string };
    ddd1?: string; telefone1?: string;
    ddd2?: string; telefone2?: string;
    email?: string;
  };
}

function formatPhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const d = raw.replace(/\D/g, "");
  // Sem DDD+número completo (mínimo 10 dígitos), considera ausente —
  // assim o fallback para outras fontes da Receita é acionado.
  if (d.length < 10) return undefined;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return raw;
}

interface ReceitaWsResponse {
  telefone?: string; // "(11) 1234-5678 / (11) 9876-5432"
  email?: string;
}

async function fetchReceitaWsPhones(clean: string): Promise<{ tel1?: string; tel2?: string; email?: string }> {
  try {
    const r = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`);
    if (!r.ok) return {};
    const d = (await r.json()) as ReceitaWsResponse;
    const phones = (d.telefone ?? "")
      .split(/[/;,]/)
      .map((s) => formatPhone(s.trim()))
      .filter(Boolean) as string[];
    return { tel1: phones[0], tel2: phones[1], email: d.email?.toLowerCase() || undefined };
  } catch {
    return {};
  }
}

function mapPublicaCnpjWs(clean: string, data: PublicaCnpjWsResponse): { profile: EnrichedProfile; address: EnrichedAddress } {
  const est = data.estabelecimento ?? {};
  return {
    profile: {
      cnpj: clean,
      razao_social: data.razao_social,
      nome_fantasia: est.nome_fantasia,
      situacao: est.situacao_cadastral,
      data_abertura: est.data_inicio_atividade,
      natureza_juridica: data.natureza_juridica?.descricao,
      porte: data.porte?.descricao,
      capital_social: data.capital_social === undefined ? undefined : Number(data.capital_social),
      cnae_principal: est.atividade_principal?.id ? String(est.atividade_principal.id) : undefined,
      cnae_principal_desc: est.atividade_principal?.descricao,
      cnaes_secundarios: (est.atividades_secundarias ?? []).map((c) => ({
        codigo: String(c.id ?? ""),
        descricao: c.descricao ?? "",
      })).filter((c) => c.codigo || c.descricao),
      socios: (data.socios ?? []).map((s) => ({
        nome: s.nome ?? "",
        qualificacao: s.qualificacao_socio?.descricao,
      })).filter((s) => s.nome),
      telefone_1: est.ddd1 && est.telefone1 ? formatPhone(est.ddd1 + est.telefone1) : undefined,
      telefone_2: est.ddd2 && est.telefone2 ? formatPhone(est.ddd2 + est.telefone2) : undefined,
      email: est.email?.toLowerCase(),
      raw: data,
    },
    address: {
      cep: est.cep,
      logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(" ") || undefined,
      numero: est.numero,
      complemento: est.complemento,
      bairro: est.bairro,
      cidade: est.cidade?.nome,
      uf: est.estado?.sigla,
    },
  };
}

export async function fetchCnpj(
  cnpj: string,
): Promise<{ profile: EnrichedProfile; address: EnrichedAddress }> {
  const clean = sanitizeCnpj(cnpj);
  if (clean.length !== 14) throw new Error("CNPJ inválido");
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
  if (!res.ok) {
    try {
      const fallback = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`);
      if (fallback.ok) return mapPublicaCnpjWs(clean, await fallback.json() as PublicaCnpjWsResponse);
    } catch {
      /* mantém erro da BrasilAPI */
    }
    throw new Error(`BrasilAPI ${res.status}`);
  }
  const data = (await res.json()) as BrasilApiResponse;

  // Fallback: BrasilAPI frequentemente retorna telefone/email vazios.
  // publica.cnpj.ws (espelho da base da Receita) costuma trazer esses dados.
  let tel1 = formatPhone(data.ddd_telefone_1);
  let tel2 = formatPhone(data.ddd_telefone_2);
  let email = data.email?.toLowerCase();
  if (!tel1 || !email) {
    try {
      const r2 = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`);
      if (r2.ok) {
        const d2 = (await r2.json()) as PublicaCnpjWsResponse;
        const est = d2.estabelecimento ?? {};
        if (!tel1 && est.ddd1 && est.telefone1) tel1 = formatPhone(est.ddd1 + est.telefone1);
        if (!tel2 && est.ddd2 && est.telefone2) tel2 = formatPhone(est.ddd2 + est.telefone2);
        if (!email && est.email) email = est.email.toLowerCase();
      }
    } catch {
      /* mantém os dados da BrasilAPI */
    }
  }

  // Segunda camada de fallback: ReceitaWS (formato consolidado em string única).
  if (!tel1 || !email) {
    const r3 = await fetchReceitaWsPhones(clean);
    if (!tel1 && r3.tel1) tel1 = r3.tel1;
    if (!tel2 && r3.tel2) tel2 = r3.tel2;
    if (!email && r3.email) email = r3.email;
  }

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
      telefone_1: tel1,
      telefone_2: tel2,
      email,
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