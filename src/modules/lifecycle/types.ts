export type PipelineStage =
  | "PROSPECCAO"
  | "CADENCIA"
  | "FECHADO"
  | "REUNIAO_INICIAL"
  | "PROPOSTA"
  | "CONTRATO"
  | "ASSINATURA"
  | "PAGAMENTO_CONFIRMADO"
  | "IMPLANTACAO"
  | "ATIVO"
  | "CHURNED"
  | "PERDIDO";

export const PIPELINE_STAGES: PipelineStage[] = [
  "PROSPECCAO",
  "CADENCIA",
  "FECHADO",
  "REUNIAO_INICIAL",
  "PROPOSTA",
  "CONTRATO",
  "ASSINATURA",
  "PAGAMENTO_CONFIRMADO",
  "IMPLANTACAO",
  "ATIVO",
];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  PROSPECCAO: "Prospecção",
  CADENCIA: "Cadência",
  FECHADO: "Fechado",
  REUNIAO_INICIAL: "Reunião Inicial",
  PROPOSTA: "Proposta",
  CONTRATO: "Contrato",
  ASSINATURA: "Assinatura",
  PAGAMENTO_CONFIRMADO: "Pagamento Confirmado",
  IMPLANTACAO: "Implantação",
  ATIVO: "Ativo",
  CHURNED: "Churn",
  PERDIDO: "Perdido",
};

export const STAGE_TONE: Record<PipelineStage, string> = {
  PROSPECCAO: "bg-slate-500/15 text-slate-300",
  CADENCIA: "bg-blue-500/15 text-blue-300",
  FECHADO: "bg-cyan-500/15 text-cyan-300",
  REUNIAO_INICIAL: "bg-indigo-500/15 text-indigo-300",
  PROPOSTA: "bg-violet-500/15 text-violet-300",
  CONTRATO: "bg-fuchsia-500/15 text-fuchsia-300",
  ASSINATURA: "bg-amber-500/15 text-amber-300",
  PAGAMENTO_CONFIRMADO: "bg-yellow-500/15 text-yellow-300",
  IMPLANTACAO: "bg-orange-500/15 text-orange-300",
  ATIVO: "bg-emerald-500/15 text-emerald-300",
  CHURNED: "bg-muted text-muted-foreground",
  PERDIDO: "bg-red-500/15 text-red-300",
};

export type FinancialStatus = "pendente" | "confirmado" | "recorrente" | "inadimplente";
export type LCContractStatus = "nao_gerado" | "enviado" | "assinado";
export type OnboardingStatus = "pendente" | "em_andamento" | "concluido";

export type LifecycleClient = {
  id: string;
  user_id: string;
  organization_id: string | null;
  company: string;
  cnpj: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  pipeline_stage: PipelineStage;
  financial_status: FinancialStatus;
  lc_contract_status: LCContractStatus;
  onboarding_status: OnboardingStatus;
  current_step: string | null;
  next_action_date: string | null;
  operations_locked: boolean;
  created_from: string | null;
  source_ref: string | null;
  activated_at: string | null;
  churned_at: string | null;
  plano_code: string | null;
  mensalidade: number | null;
  contract_term_months: number | null;
  contract_end_at: string | null;
  is_permuta: boolean;
  permuta_value: number | null;
  permuta_description: string | null;
  site_one_time_value: number | null;
  site_recurring_value: number | null;
  site_payment_status: string | null;
  contract_notes: string | null;
  origem: string | null;
  origem_detalhe: string | null;
  ajustes_escopo: string | null;
  ajustes_prazo: string | null;
  ajustes_proxima_acao: string | null;
  ajustes_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export const ORIGEM_OPTIONS: { value: string; label: string }[] = [
  { value: "indicacao", label: "Indicação" },
  { value: "prospeccao_fria", label: "Prospecção fria" },
  { value: "instagram", label: "Instagram" },
  { value: "anuncio", label: "Anúncio pago" },
  { value: "evento", label: "Evento / networking" },
  { value: "parceiro", label: "Parceiro" },
  { value: "site_organico", label: "Site / busca orgânica" },
  { value: "retorno", label: "Cliente antigo (retorno)" },
  { value: "outro", label: "Outro" },
];

export const ORIGEM_LABEL: Record<string, string> = Object.fromEntries(
  ORIGEM_OPTIONS.map((o) => [o.value, o.label]),
);

export type CommercialPlan = {
  client_id: string;
  investimento_gestao: number | null;
  investimento_trafego: number | null;
  objetivo: string | null;
  entregas: string[];
  cronograma: Record<string, unknown>;
  validade_dias: number;
  plano_code: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanTemplate = {
  code: string;
  name: string;
  mensalidade: number;
  campaigns: string[];
  deliveries: string[];
};

export type ClientTimelineItem = {
  client_id: string;
  created_at: string;
  kind: "transition" | "event";
  data: Record<string, unknown>;
};