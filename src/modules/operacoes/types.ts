export type OpClienteStatus = "ativo" | "pausado" | "offboarding" | "encerrado";
export type OpPlataforma = "meta_ads" | "google_ads" | "tiktok_ads" | "linkedin_ads";
export type OpEntregaStatus = "backlog" | "em_andamento" | "revisao" | "entregue";
export type OpEntregaTipo = "criativo" | "relatorio" | "otimizacao" | "reuniao" | "outro";

export const OP_CLIENTE_STATUS_LABEL: Record<OpClienteStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  offboarding: "Offboarding",
  encerrado: "Encerrado",
};

export const OP_PLATAFORMA_LABEL: Record<OpPlataforma, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
  linkedin_ads: "LinkedIn Ads",
};

export const OP_ENTREGA_STATUS_LABEL: Record<OpEntregaStatus, string> = {
  backlog: "Backlog",
  em_andamento: "Em andamento",
  revisao: "Revisão",
  entregue: "Entregue",
};

export const OP_ENTREGA_TIPO_LABEL: Record<OpEntregaTipo, string> = {
  criativo: "Criativo",
  relatorio: "Relatório",
  otimizacao: "Otimização",
  reuniao: "Reunião",
  outro: "Outro",
};

export const OP_ENTREGA_STATUSES: OpEntregaStatus[] = [
  "backlog",
  "em_andamento",
  "revisao",
  "entregue",
];

export type OpCliente = {
  id: string;
  nome: string;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  status: OpClienteStatus;
  responsavel_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpTrafegoConta = {
  id: string;
  cliente_id: string;
  plataforma: OpPlataforma;
  nome_conta: string;
  conta_id_externa: string | null;
  verba_mensal: number;
  objetivo: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type OpTrafegoCampanha = {
  id: string;
  cliente_id: string;
  conta_id: string | null;
  plataforma: OpPlataforma;
  nome: string;
  status: string;
  verba: number;
  gasto: number;
  impressoes: number;
  cliques: number;
  conversoes: number;
  cpa: number;
  roas: number;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  ultima_sync: string | null;
  created_at: string;
  updated_at: string;
};

export type OpEntrega = {
  id: string;
  cliente_id: string | null;
  titulo: string;
  tipo: OpEntregaTipo;
  responsavel_id: string | null;
  status: OpEntregaStatus;
  prazo: string | null;
  descricao: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};