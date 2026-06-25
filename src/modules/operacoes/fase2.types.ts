// Tipos da Fase 2 (Onboarding, Implantação, Campanhas, Relacionamento, Renovações).

export type OpOnboardingStatus =
  | "pendente"
  | "aguardando_cliente"
  | "em_configuracao"
  | "concluido";

export const OP_ONBOARDING_STATUS_LABEL: Record<OpOnboardingStatus, string> = {
  pendente: "Pendente",
  aguardando_cliente: "Aguardando Cliente",
  em_configuracao: "Em Configuração",
  concluido: "Concluído",
};

export type OpOnboarding = {
  id: string;
  client_id: string;
  owner_id: string;
  company_name: string | null;
  cnpj: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  meta_ads_connected: boolean;
  google_ads_connected: boolean;
  analytics_connected: boolean;
  tag_manager_connected: boolean;
  goal_type: string | null;
  status: OpOnboardingStatus;
  created_at: string;
  updated_at: string;
};

export type OpOnboardingProgress = {
  id: string;
  client_id: string;
  owner_id: string;
  status: OpOnboardingStatus;
  steps_done: number;
  steps_total: number;
  progress: number;
};

// Implantação
export type OpDeploymentCategory =
  | "Pixel"
  | "CAPI"
  | "Analytics"
  | "Tag Manager"
  | "Landing Page"
  | "Google Ads"
  | "Meta Ads"
  | "CRM"
  | "Automação";

export const OP_DEPLOYMENT_CATEGORIES: OpDeploymentCategory[] = [
  "Pixel",
  "CAPI",
  "Analytics",
  "Tag Manager",
  "Landing Page",
  "Google Ads",
  "Meta Ads",
  "CRM",
  "Automação",
];

export type OpDeploymentStatus =
  | "nao_iniciado"
  | "em_andamento"
  | "aguardando_aprovacao"
  | "concluido";

export const OP_DEPLOYMENT_STATUS_LABEL: Record<OpDeploymentStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  concluido: "Concluído",
};

export type OpDeploymentPriority = "Baixa" | "Normal" | "Alta" | "Crítica";
export const OP_DEPLOYMENT_PRIORITIES: OpDeploymentPriority[] = [
  "Baixa",
  "Normal",
  "Alta",
  "Crítica",
];

export type OpDeployment = {
  id: string;
  client_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: OpDeploymentCategory;
  status: OpDeploymentStatus;
  priority: OpDeploymentPriority;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

// Campanhas (gestão estratégica)
export type OpCampaignPlatform = "Meta Ads" | "Google Ads" | "TikTok Ads" | "LinkedIn Ads";
export const OP_CAMPAIGN_PLATFORMS: OpCampaignPlatform[] = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "LinkedIn Ads",
];

export type OpCampaignStatus = "rascunho" | "ativa" | "pausada" | "encerrada";
export const OP_CAMPAIGN_STATUS_LABEL: Record<OpCampaignStatus, string> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

export type OpCampaign = {
  id: string;
  client_id: string;
  owner_id: string;
  campaign_name: string;
  platform: OpCampaignPlatform;
  objective: string | null;
  daily_budget: number;
  monthly_budget: number;
  investment_to_date: number;
  results_count: number;
  cost_per_result: number;
  status: OpCampaignStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

// Relacionamento
export type OpInteractionType =
  | "WhatsApp"
  | "Ligação"
  | "Reunião"
  | "E-mail"
  | "Suporte"
  | "Solicitação";

export const OP_INTERACTION_TYPES: OpInteractionType[] = [
  "WhatsApp",
  "Ligação",
  "Reunião",
  "E-mail",
  "Suporte",
  "Solicitação",
];

export type OpInteraction = {
  id: string;
  client_id: string;
  owner_id: string;
  interaction_type: OpInteractionType;
  title: string;
  notes: string | null;
  interaction_date: string;
  next_followup_at: string | null;
  created_by: string | null;
  created_at: string;
};

// Renovações
export type OpRenewalStoredStatus = "ativo" | "renovado" | "cancelado";
export type OpRenewalComputedStatus =
  | "Ativo"
  | "Próximo Vencimento"
  | "Urgente"
  | "Vencido"
  | "Renovado"
  | "Cancelado";

export type OpContractRenewal = {
  id: string;
  client_id: string;
  owner_id: string;
  contract_start: string | null;
  contract_end: string;
  renewal_status: OpRenewalStoredStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpRenewalView = OpContractRenewal & {
  days_to_expire: number;
  computed_status: OpRenewalComputedStatus;
};

// Dashboard executivo
export type OpExecMetrics = {
  total_clientes: number;
  clientes_ativos: number;
  clientes_inativos: number;
  onboarding_pendente: number;
  onboarding_em_configuracao: number;
  onboarding_concluido: number;
  deployments_total: number;
  deployments_concluidos: number;
  deployments_andamento: number;
  campanhas_ativas: number;
  campanhas_pausadas: number;
  campanhas_encerradas: number;
  interacoes_30d: number;
  clientes_sem_onboarding: number;
  clientes_sem_campanha_ativa: number;
  clientes_com_implantacao_pendente: number;
  contratos_vencendo_30d: number;
};