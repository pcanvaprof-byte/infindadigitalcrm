export type ProspectStatus =
  | "nao_contatado"
  | "primeiro_contato"
  | "em_negociacao"
  | "qualificado"
  | "agendado"
  | "perdido"
  | "briefing_enviado"
  | "diagnostico_pendente"
  | "proposta_pendente"
  | "proposta_enviada"
  | "fechado_ganho"
  | "aguardando_kickoff"
  | "aguardando_producao"
  | "em_producao"
  | "entregue"
  | "cliente";

export type ProspectPotential = "alto" | "medio" | "baixo";

export interface Prospect {
  id: string;
  company: string;
  cnpj?: string;
  segment: string;
  owner: string;
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  state: string;
  source: string;
  potential: ProspectPotential;
  status: ProspectStatus;
  createdAt: string;
  updatedAt?: string | null;
  interactions?: Interaction[];
  // Cadência comercial (Fase 6) — populados após migration; opcionais até lá.
  cadenceStep?: number;            // 0..6
  cadenceStatus?: "ativo" | "pausado" | "encerrado";
  responseStatus?:
    | "sem_resposta"
    | "respondeu"
    | "interessado"
    | "sem_interesse"
    | "cliente";
  lastContactAt?: string | null;
  nextContactAt?: string | null;
}

export type InteractionKind =
  | "whatsapp"
  | "ligacao"
  | "email"
  | "reuniao"
  | "nota"
  | "status";

export interface Interaction {
  id: string;
  kind: InteractionKind;
  text: string;
  by: string;
  at: string;
}

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  nao_contatado: "Não contatado",
  primeiro_contato: "Primeiro contato",
  em_negociacao: "Em andamento",
  qualificado: "Qualificado",
  agendado: "Agendado",
  perdido: "Perdido",
  briefing_enviado: "Briefing enviado",
  diagnostico_pendente: "Diagnóstico pendente",
  proposta_pendente: "Proposta pendente",
  proposta_enviada: "Proposta enviada",
  fechado_ganho: "Ganho",
  aguardando_kickoff: "Aguardando kickoff",
  aguardando_producao: "Aguardando produção",
  em_producao: "Em produção",
  entregue: "Entregue",
  cliente: "Cliente",
};

export const STATUS_TONE: Record<ProspectStatus, string> = {
  nao_contatado: "bg-muted text-muted-foreground border-border",
  primeiro_contato: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  em_negociacao: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  qualificado: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  agendado: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  perdido: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  briefing_enviado: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  diagnostico_pendente: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
  proposta_pendente: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  proposta_enviada: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  fechado_ganho: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  aguardando_kickoff: "bg-teal-500/10 text-teal-300 border-teal-500/20",
  aguardando_producao: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  em_producao: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  entregue: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  cliente: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
};

export const POTENTIAL_LABEL: Record<ProspectPotential, string> = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

export const POTENTIAL_TONE: Record<ProspectPotential, string> = {
  alto: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  medio: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  baixo: "bg-muted text-muted-foreground border-border",
};

export const SEGMENTS = [
  "Alimentação",
  "Beleza",
  "Saúde",
  "Educação",
  "Varejo",
  "Automotivo",
  "Fitness",
  "Pet",
  "Imobiliária",
  "Serviços",
  "Tecnologia",
  "Outros",
];

export const SOURCES = [
  "Indicação",
  "Instagram",
  "Google",
  "Prospecção ativa",
  "Evento",
  "Site",
  "WhatsApp",
  "Importação",
];

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const INITIAL_PROSPECTS: Prospect[] = [];
