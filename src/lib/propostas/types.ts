export type ProposalStatus =
  | "rascunho"
  | "enviada"
  | "visualizada"
  | "ajustes_solicitados"
  | "aprovada"
  | "rejeitada"
  | "expirada"
  | "convertida";

export type ContractStatus =
  | "nao_gerado"
  | "gerado"
  | "enviado"
  | "assinado"
  | "cancelado";

export type Cobranca = "implantacao" | "mensal" | "avulso";

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  visualizada: "Visualizada",
  ajustes_solicitados: "Ajustes solicitados",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  expirada: "Expirada",
  convertida: "Convertida",
};

export const PROPOSAL_STATUS_TONE: Record<ProposalStatus, string> = {
  rascunho: "bg-slate-500/15 text-slate-300",
  enviada: "bg-sky-500/15 text-sky-300",
  visualizada: "bg-indigo-500/15 text-indigo-300",
  ajustes_solicitados: "bg-amber-500/15 text-amber-300",
  aprovada: "bg-emerald-500/15 text-emerald-300",
  rejeitada: "bg-rose-500/15 text-rose-300",
  expirada: "bg-zinc-500/15 text-zinc-300",
  convertida: "bg-emerald-500/20 text-emerald-200",
};

export interface ProposalContent {
  capa?: { titulo?: string; subtitulo?: string };
  sobre?: string;
  diagnostico?: string;
  problemas?: string[];
  solucao?: string;
  escopo?: string;
  cronograma?: string;
  observacoes?: string;
  /**
   * Configuração opcional do bloco "Potencial de Crescimento".
   * Quando presente, ativa a renderização automática da seção.
   */
  crescimento?: {
    enabled: boolean;
    nicho: string;
    tipo_negocio?: string | null;
    ticket_medio: number;
    maturidade: "baixa" | "media" | "alta";
  };
}

export interface ProposalItem {
  id: string;
  proposal_id: string;
  catalog_item_id: string | null;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  area: string | null;
  cobranca: Cobranca;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  prazo_dias: number | null;
  entregaveis: string[];
  ordem: number;
  created_at: string;
}

export interface ProposalVersion {
  id: string;
  proposal_id: string;
  version_number: number;
  conteudo_json: ProposalContent;
  valor_implantacao: number;
  valor_mensal: number;
  valor_avulso: number;
  observacoes: string | null;
  created_at: string;
}

export interface Proposal {
  id: string;
  user_id: string;
  deal_id: string | null;
  client_id: string | null;
  lead_id: string | null;
  numero: string;
  titulo: string;
  status: ProposalStatus;
  current_version_id: string | null;
  valor_implantacao: number;
  valor_mensal: number;
  valor_avulso: number;
  desconto_pct: number;
  validade_dias: number;
  valid_until: string | null;
  token_publico: string;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  contract_status: ContractStatus;
  motivo_perda: string | null;
  motivo_aprovacao: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  decided_at: string | null;
  expired_at: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  /** Resumo do escopo comercial (texto livre, além dos itens do catálogo). */
  escopo: string | null;
  /** Prazo/cronograma acordado com o cliente (texto curto). */
  prazo: string | null;
  /** Próxima ação combinada (ex.: "Ligar quarta às 14h para fechar"). */
  proxima_acao: string | null;
  /** Quando a próxima ação deve acontecer (ISO string). */
  proxima_acao_em: string | null;
  /** Responsável pela próxima ação. */
  proxima_acao_responsavel: string | null;
}

export interface ProposalEvent {
  id: string;
  proposal_id: string;
  tipo: string;
  actor_type: "user" | "client" | "system";
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PublicProposal {
  id: string;
  numero: string;
  titulo: string;
  status: ProposalStatus;
  valor_implantacao: number;
  valor_mensal: number;
  valor_avulso: number;
  validade_dias: number;
  valid_until: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  current_version_id: string | null;
  cliente: { company?: string; contact_name?: string; segment?: string; city?: string; state?: string } | null;
  lead: { company?: string; owner?: string; segment?: string } | null;
  versao: { version_number: number; conteudo_json: ProposalContent } | null;
  items: ProposalItem[];
}

export type ProposalAdjustmentOrigem = "cliente" | "interno";
export type ProposalAdjustmentStatus = "aberto" | "em_analise" | "resolvido" | "descartado";

export const ADJUSTMENT_STATUS_LABEL: Record<ProposalAdjustmentStatus, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  resolvido: "Resolvido",
  descartado: "Descartado",
};

export const ADJUSTMENT_STATUS_TONE: Record<ProposalAdjustmentStatus, string> = {
  aberto: "bg-amber-500/15 text-amber-300",
  em_analise: "bg-sky-500/15 text-sky-300",
  resolvido: "bg-emerald-500/15 text-emerald-300",
  descartado: "bg-zinc-500/15 text-zinc-300",
};

export interface ProposalAdjustment {
  id: string;
  proposal_id: string;
  origem: ProposalAdjustmentOrigem;
  autor_nome: string | null;
  autor_cargo: string | null;
  mensagem: string;
  status: ProposalAdjustmentStatus;
  resolvido_em: string | null;
  resolvido_por: string | null;
  created_at: string;
}