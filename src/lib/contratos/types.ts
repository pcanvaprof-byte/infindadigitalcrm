export type ContratoStatus =
  | "aguardando_formalizacao"
  | "em_preenchimento"
  | "aguardando_assinatura"
  | "assinado"
  | "pendente_financeiro"
  | "ativo"
  | "cancelado"
  | "encerrado";

export type TipoPessoa = "pf" | "pj";
export type MetodoPagamento = "pix" | "boleto" | "cartao" | "transferencia";
export type AssinaturaTipo = "desenhada" | "digitada" | "email";

export const CONTRATO_STATUS_LABEL: Record<ContratoStatus, string> = {
  aguardando_formalizacao: "Aguardando formalização",
  em_preenchimento: "Em preenchimento",
  aguardando_assinatura: "Aguardando assinatura",
  assinado: "Assinado",
  pendente_financeiro: "Pendente financeiro",
  ativo: "Ativo",
  cancelado: "Cancelado",
  encerrado: "Encerrado",
};

export const CONTRATO_STATUS_TONE: Record<ContratoStatus, string> = {
  aguardando_formalizacao: "bg-amber-500/15 text-amber-300",
  em_preenchimento: "bg-sky-500/15 text-sky-300",
  aguardando_assinatura: "bg-indigo-500/15 text-indigo-300",
  assinado: "bg-emerald-500/15 text-emerald-300",
  pendente_financeiro: "bg-orange-500/15 text-orange-300",
  ativo: "bg-emerald-500/20 text-emerald-200",
  cancelado: "bg-rose-500/15 text-rose-300",
  encerrado: "bg-zinc-500/15 text-zinc-300",
};

export interface DadosPessoaPF {
  nome?: string;
  cpf?: string;
  rg?: string;
  orgao_emissor?: string;
  estado_civil?: string;
  profissao?: string;
  nascimento?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  complemento?: string;
}

export interface DadosPessoaPJ {
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  responsavel?: string;
  cpf_responsavel?: string;
  rg_responsavel?: string;
  cargo?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  complemento?: string;
}

export type DadosPessoa = DadosPessoaPF | DadosPessoaPJ;

export interface DadosBancarios {
  banco?: string;
  agencia?: string;
  conta?: string;
  pix?: string;
}

export interface EscopoItem {
  nome: string;
  cobranca: string;
  quantidade: number;
  valor_total: number;
  prazo_dias: number | null;
  entregaveis: string[];
  observacoes?: string;
}

export interface Aceites {
  leu_contrato?: boolean;
  concorda_condicoes?: boolean;
  dados_corretos?: boolean;
  autoriza_assinatura?: boolean;
}

export interface Contrato {
  id: string;
  user_id: string;
  proposal_id: string;
  numero: string;
  status: ContratoStatus;

  valor_implantacao: number;
  valor_mensal: number;
  valor_investimento_midia: number | null;
  prazo_minimo_meses: number;
  prazo_implantacao_dias: number | null;

  tipo_pessoa: TipoPessoa | null;
  dados_pessoa: DadosPessoa;

  metodo_pagamento: MetodoPagamento | null;
  dia_vencimento: number | null;
  parcelamento_implantacao: number | null;
  dados_bancarios: DadosBancarios;
  observacoes_financeiras: string | null;

  escopo: EscopoItem[];
  aceites: Aceites;

  assinatura_tipo: AssinaturaTipo | null;
  assinatura_payload: string | null;
  assinatura_nome: string | null;
  assinatura_ip: string | null;
  assinatura_user_agent: string | null;
  assinado_em: string | null;

  pdf_url: string | null;
  pdf_gerado_em: string | null;

  formalizado_em: string | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;

  created_at: string;
  updated_at: string;
}

export interface ContratoEvento {
  id: string;
  contrato_id: string;
  tipo: string;
  payload: Record<string, unknown>;
  actor_id: string | null;
  actor_type: string;
  ip: string | null;
  created_at: string;
}

export interface ContratoKpis {
  ativos: number;
  pendentes: number;
  assinados: number;
  cancelados: number;
  mrr: number;
  arr: number;
  ticket_medio: number;
}