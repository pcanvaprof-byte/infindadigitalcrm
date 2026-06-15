export type PipelineStage =
  | "lead"
  | "contato"
  | "qualificado"
  | "apresentacao"
  | "reuniao"
  | "proposta"
  | "negociacao"
  | "fechado"
  | "perdido";

export interface Deal {
  id: string;
  company: string;
  segment: string;
  contact: string;
  city: string;
  value: number;
  stage: PipelineStage;
  owner: string;
  whatsapp?: string;
  updatedAt: string;
}

export const STAGES: { id: PipelineStage; label: string; tone: string }[] = [
  { id: "lead", label: "Lead", tone: "oklch(0.7 0.04 250)" },
  { id: "contato", label: "Contato Feito", tone: "oklch(0.72 0.12 220)" },
  { id: "qualificado", label: "Qualificado", tone: "oklch(0.72 0.14 200)" },
  { id: "apresentacao", label: "Apresentação", tone: "oklch(0.7 0.18 264)" },
  { id: "reuniao", label: "Reunião", tone: "oklch(0.72 0.18 290)" },
  { id: "proposta", label: "Proposta", tone: "oklch(0.78 0.16 75)" },
  { id: "negociacao", label: "Negociação", tone: "oklch(0.72 0.18 35)" },
  { id: "fechado", label: "Fechado", tone: "oklch(0.7 0.17 158)" },
  { id: "perdido", label: "Perdido", tone: "oklch(0.62 0.15 25)" },
];

export const INITIAL_DEALS: Deal[] = [];

