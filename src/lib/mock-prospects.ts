export type ProspectStatus =
  | "nao_contatado"
  | "primeiro_contato"
  | "em_negociacao"
  | "qualificado"
  | "agendado"
  | "perdido";

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
  interactions?: Interaction[];
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
  em_negociacao: "Em negociação",
  qualificado: "Qualificado",
  agendado: "Agendado",
  perdido: "Perdido",
};

export const STATUS_TONE: Record<ProspectStatus, string> = {
  nao_contatado: "bg-muted text-muted-foreground border-border",
  primeiro_contato: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  em_negociacao: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  qualificado: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  agendado: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  perdido: "bg-rose-500/10 text-rose-300 border-rose-500/20",
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
