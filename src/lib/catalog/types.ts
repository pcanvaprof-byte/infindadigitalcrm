export type CatalogTipo = "servico" | "pacote" | "complemento" | "bonus";
export type CatalogCobranca = "implantacao" | "mensal" | "avulso";
export type CatalogComplexidade = "baixa" | "media" | "alta";
export type CatalogArea =
  | "comercial"
  | "marketing"
  | "desenvolvimento"
  | "design"
  | "ia"
  | "suporte"
  | "outros";
export type CatalogRelTipo = "complemento" | "dependencia";

export interface CatalogCategoria {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

export interface CatalogItem {
  id: string;
  tipo: CatalogTipo;
  codigo: string | null;
  nome_comercial: string;
  nome_interno: string | null;
  categoria_id: string | null;
  subcategoria: string | null;
  descricao_curta: string | null;
  descricao_completa: string | null;
  beneficios: string[];
  entregaveis: string[];
  nao_incluso: string[];
  prazo_estimado_dias: number | null;
  complexidade: CatalogComplexidade;
  prioridade: number;
  area_responsavel: CatalogArea;
  tempo_execucao_horas: number | null;
  objetivo: string | null;
  cobranca: CatalogCobranca;
  valor_implantacao: number;
  valor_mensal: number;
  valor_avulso: number;
  ativo: boolean;
  ordem: number;
  tags: string[];
  observacoes_internas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const TIPO_LABEL: Record<CatalogTipo, string> = {
  servico: "Serviço",
  pacote: "Pacote",
  complemento: "Complemento",
  bonus: "Bônus",
};

export const TIPO_ICON: Record<CatalogTipo, string> = {
  servico: "🛠️",
  pacote: "📦",
  complemento: "➕",
  bonus: "🎁",
};

export const COBRANCA_LABEL: Record<CatalogCobranca, string> = {
  implantacao: "Implantação (único)",
  mensal: "Mensal recorrente",
  avulso: "Avulso / por uso",
};

export const COMPLEXIDADE_LABEL: Record<CatalogComplexidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const AREA_LABEL: Record<CatalogArea, string> = {
  comercial: "Comercial",
  marketing: "Marketing",
  desenvolvimento: "Desenvolvimento",
  design: "Design",
  ia: "IA",
  suporte: "Suporte",
  outros: "Outros",
};

export const TIPO_OPTIONS: CatalogTipo[] = ["servico", "pacote", "complemento", "bonus"];
export const COBRANCA_OPTIONS: CatalogCobranca[] = ["implantacao", "mensal", "avulso"];
export const COMPLEXIDADE_OPTIONS: CatalogComplexidade[] = ["baixa", "media", "alta"];
export const AREA_OPTIONS: CatalogArea[] = [
  "comercial",
  "marketing",
  "desenvolvimento",
  "design",
  "ia",
  "suporte",
  "outros",
];

export function formatBRL(value: number | null | undefined): string {
  const v = typeof value === "number" ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function precoExibido(item: Pick<CatalogItem, "cobranca" | "valor_implantacao" | "valor_mensal" | "valor_avulso">): string {
  switch (item.cobranca) {
    case "mensal":
      return `${formatBRL(item.valor_mensal)}/mês`;
    case "avulso":
      return `${formatBRL(item.valor_avulso)} avulso`;
    case "implantacao":
    default:
      return formatBRL(item.valor_implantacao);
  }
}