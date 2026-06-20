/**
 * ProposalViewModel — ÚNICA FONTE DE VERDADE para qualquer renderização
 * (Web pública, Portal do Cliente, Print/PDF, Apresentação, Email).
 *
 * Regra: nenhum componente de render deve consultar Supabase, window,
 * location ou token. Tudo entra via este modelo + callbacks.
 */

import type { ProposalStatus } from "@/lib/propostas/types";

export type RenderMode = "web" | "print" | "presentation" | "email" | "portal";

export type ContentSource = "ai" | "fallback" | "manual";

export interface VMHeader {
  numero: string;
  titulo: string;
  status: ProposalStatus;
  validadeAte: string | null;
  diasRestantes: number | null;
  expirada: boolean;
  cliente: {
    nome: string;
    contato: string | null;
    segmento: string | null;
    cidade: string | null;
    estado: string | null;
  };
  owner: {
    nome: string | null;
    papel: "owner" | "closer" | "consultor";
  } | null;
}

export interface VMDiagnostico {
  texto: string;
  riscosAtuais: string[];
  oportunidadesPerdidas: string[];
}

export interface VMSolucao {
  problemas: string[];
  solucao: string;
  diferenciaisCompetitivos: string[];
  ganhosEsperados: string[];
}

export interface VMBeneficio {
  titulo: string;
  descricao: string;
  icone?: string;
}

export interface VMROI {
  economiaEstimada: number | null;
  faturamentoAdicional: number | null;
  paybackMeses: number | null;
  premissas: string[];
}

export type CrescimentoMaturidade = "baixa" | "media" | "alta";
export type CrescimentoCenarioNome = "Conservador" | "Esperado" | "Agressivo";

export interface VMCrescimentoCenario {
  nome: CrescimentoCenarioNome;
  faturamento90: number;
  faturamento180: number;
  roi90: number; // múltiplo (x)
  roi180: number;
  novosClientes90: number;
  novosClientes180: number;
  justificativa: string;
}

export interface VMCrescimento {
  nicho: string;
  tipoNegocio: string | null;
  ticketMedio: number;
  investimentoMensal: number;
  maturidade: CrescimentoMaturidade;
  cenarios: VMCrescimentoCenario[];
  premissas: string[];
  fechamento: string;
}

export interface VMTimelineEntrega {
  semana: string;
  titulo: string;
  entregas: string[];
}

export interface VMCase {
  cliente: string;
  segmento: string | null;
  desafio: string;
  resultado: string;
}

export interface VMItem {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  cobranca: "implantacao" | "mensal" | "avulso";
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  prazoDias: number | null;
  entregaveis: string[];
  obrigatorio: boolean;
  decisao: "aceito" | "recusado" | "pendente";
}

export interface VMPacote {
  id: string;
  nome: string;
  recomendado: boolean;
  itens: VMItem[];
  totalImplantacao: number;
  totalMensal: number;
  totalAvulso: number;
}

export interface VMInvestimento {
  implantacao: number;
  mensal: number;
  avulso: number;
  total12m: number;
  parcelasSugeridas: { vezes: number; valor: number }[];
  descontoAplicado: number;
}

export interface VMAnexo {
  id: string;
  nome: string;
  url: string;
  mime: string | null;
  tamanho: number | null;
}

export interface VMCapabilities {
  canApproveProposal: boolean;
  canApproveItems: boolean;
  canRequestAdjustment: boolean;
  canReject: boolean;
  canDownloadPdf: boolean;
  canViewInternalNotes: boolean;
  showStickyCTA: boolean;
  mode: RenderMode;
}

export interface VMMeta {
  source: ContentSource;
  generatedAt: string | null;
  publicUrl: string | null;
  versionNumber: number | null;
}

export type ItemDecisionsState = "complete" | "partial" | "missing";

export interface ProposalViewModel {
  id: string;
  header: VMHeader;
  diagnostico: VMDiagnostico;
  solucao: VMSolucao;
  beneficios: VMBeneficio[];
  porqueInfinda: string[];
  roi: VMROI;
  pacotes: VMPacote[];
  itens: VMItem[];
  investimento: VMInvestimento;
  timeline: VMTimelineEntrega[];
  cases: VMCase[];
  proximosPassos: string[];
  observacoes: string | null;
  anexos: VMAnexo[];
  capabilities: VMCapabilities;
  meta: VMMeta;
  /** Bloco opcional "Potencial de Crescimento". null = não exibir. */
  crescimento: VMCrescimento | null;
  /**
   * Indica se as decisões por item foram resolvidas:
   * - 'complete': todas conhecidas
   * - 'partial': algumas vieram, outras assumidas pendentes
   * - 'missing': nenhuma decisão consultada (CRM listagem rápida, por ex.)
   */
  itemDecisionsState: ItemDecisionsState;
}

/**
 * Callbacks injetados pelo modo de render. Nenhum componente de seção
 * acessa rede/router diretamente — tudo passa por aqui.
 */
export interface ProposalViewModelHandlers {
  onView?: () => void;
  onApproveAll?: (cliente: { nome: string; email: string }) => Promise<void>;
  onApproveItem?: (itemId: string, cliente: { nome: string; email: string }) => Promise<void>;
  onRejectItem?: (itemId: string) => Promise<void>;
  onRequestAdjustment?: (mensagem: string, cliente: { nome: string; email: string }) => Promise<void>;
  onReject?: (motivo: string, observacao?: string) => Promise<void>;
  onDownloadPdf?: () => void;
  onShareOnWhatsapp?: () => void;
}