export type BriefingServico = "pagina_vendas" | "mentoria_trafego" | "gestao_trafego";
export type BriefingStatus = "pendente" | "em_preenchimento" | "concluido" | "cancelado";

export interface BriefingQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "radio";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface BriefingSection {
  id: string;
  title: string;
  questions: BriefingQuestion[];
}

export interface Briefing {
  id: string;
  user_id: string;
  cliente_nome: string | null;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  servico: BriefingServico;
  status: BriefingStatus;
  token_publico: string;
  respostas_json: Record<string, string>;
  resumo_ia: string | null;
  responsavel: string | null;
  created_at: string;
  updated_at: string;
}

export const SERVICO_LABEL: Record<BriefingServico, string> = {
  pagina_vendas: "Página de Vendas",
  mentoria_trafego: "Mentoria de Tráfego Pago",
  gestao_trafego: "Gestão de Tráfego Pago",
};

export const STATUS_LABEL: Record<BriefingStatus, string> = {
  pendente: "Pendente",
  em_preenchimento: "Em preenchimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};