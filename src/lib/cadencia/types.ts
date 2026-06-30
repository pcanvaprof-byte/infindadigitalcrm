export const CAD_STAGES = [
  "followup_1","followup_2","followup_3","followup_4",
  "followup_5","followup_6","followup_7",
  "interessado","reuniao_agendada","proposta_enviada",
  "negociacao","fechado","perdido",
] as const;

export type CadStage = typeof CAD_STAGES[number];

export const CAD_STAGE_LABEL: Record<CadStage, string> = {
  followup_1: "Follow-up 1",
  followup_2: "Follow-up 2",
  followup_3: "Follow-up 3",
  followup_4: "Follow-up 4",
  followup_5: "Follow-up 5",
  followup_6: "Follow-up 6",
  followup_7: "Follow-up 7",
  interessado: "Interessado",
  reuniao_agendada: "Reunião Agendada",
  proposta_enviada: "Proposta Enviada",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const CAD_FOLLOWUP_DAYS: Partial<Record<CadStage, number>> = {
  followup_1: 3,
  followup_2: 7,
  followup_3: 10,
  followup_4: 14,
  followup_5: 18,
  followup_6: 24,
  followup_7: 30,
};

export type CadTemp = "quente" | "morno" | "frio";
export const CAD_TEMP_LABEL: Record<CadTemp, string> = {
  quente: "🔥 Quente",
  morno: "🟡 Morno",
  frio: "❄️ Frio",
};

export type CadMsgTipo = "whatsapp" | "email" | "ligacao" | "nota" | "sistema";
export type CadMsgDirection = "out" | "in" | "system";

export type CadLead = {
  id: string;
  organization_id: string;
  owner_id: string;
  prospect_id: string | null;
  empresa: string;
  responsavel: string | null;
  cargo: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  stage: CadStage;
  temperatura: CadTemp;
  primeira_abordagem_at: string;
  last_contact_at: string | null;
  next_action_at: string | null;
  last_response_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CadMessage = {
  id: string;
  lead_id: string;
  organization_id: string;
  author_id: string | null;
  tipo: CadMsgTipo;
  direction: CadMsgDirection;
  stage_at_send: CadStage | null;
  mensagem: string | null;
  status: string;
  created_at: string;
};

export type CadTemplate = {
  id: string;
  organization_id: string;
  stage: CadStage;
  titulo: string;
  corpo: string;
  updated_at: string;
};

export type CadMetrics = {
  total: number;
  by_stage: Partial<Record<CadStage, number>>;
  taxa_resposta: number;
  taxa_conversao: number;
  total_mensagens: number;
  serie_30d: Array<{ dia: string; enviadas: number; respostas: number }>;
};

/** Primeiro nome do responsável (antes do primeiro espaço). */
export function primeiroNome(nome: string | null | undefined): string {
  const n = (nome || "").trim();
  if (!n) return "";
  return n.split(/\s+/)[0];
}

/** Nome curto da empresa: remove sufixos societários (LTDA, ME, EIRELI, S/A…) e mantém até 2 palavras. */
export function empresaCurta(nome: string | null | undefined): string {
  const raw = (nome || "").trim();
  if (!raw) return "";
  const limpo = raw
    .replace(/[,\-–|].*$/, "")
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\.?\/?A\.?|SA|S\.A|S\/A|MEI|CIA|COMPANY|CO|INC|LLC)\.?$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const partes = limpo.split(" ");
  return partes.slice(0, 2).join(" ") || limpo;
}

export function renderTemplate(corpo: string, lead: Pick<CadLead, "empresa" | "responsavel">): string {
  const emp = lead.empresa || "";
  const resp = lead.responsavel || "";
  return (corpo || "")
    .replaceAll("{{primeiro_nome}}", primeiroNome(resp))
    .replaceAll("{{empresa_curta}}", empresaCurta(emp))
    .replaceAll("{{empresa}}", emp)
    .replaceAll("{{responsavel}}", resp);
}

/**
 * Separador de variantes dentro de `corpo`. Permite cadastrar 2+ versões
 * da mesma mensagem para rotacionar entre disparos e reduzir bloqueios
 * por padrão repetido detectado pelo WhatsApp.
 *
 * Ex.: "Oi {{primeiro_nome}}, tudo bem?\n---\nE aí {{primeiro_nome}}, beleza?"
 */
export const VARIANT_SEPARATOR_RE = /\n\s*---+\s*\n/;

export function splitVariants(corpo: string | null | undefined): string[] {
  const raw = (corpo || "").trim();
  if (!raw) return [];
  return raw
    .split(VARIANT_SEPARATOR_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Escolhe uma variante por round-robin persistido em localStorage.
 * `key` identifica o "balde" de rotação (ex.: stage da cadência, canal
 * da prospecção). Se houver só uma variante, devolve o índice 0.
 * Em SSR (sem `window`) cai num pseudo-aleatório determinístico.
 */
export function pickVariantIndex(total: number, key: string): number {
  if (total <= 1) return 0;
  const storageKey = `msg_rot:${key}`;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const cur = Number(window.localStorage.getItem(storageKey) || "0") || 0;
      const next = (cur + 1) % total;
      window.localStorage.setItem(storageKey, String(next));
      return cur % total;
    }
  } catch { /* ignore */ }
  return Math.floor(Math.random() * total);
}

export function diasSemResposta(lead: Pick<CadLead, "last_response_at" | "primeira_abordagem_at">): number {
  const base = lead.last_response_at ?? lead.primeira_abordagem_at;
  if (!base) return 0;
  const ms = Date.now() - new Date(base).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/** Outcomes: lead sai da cadência e não deve mais aparecer na fila. */
export const CAD_OUTCOME_STAGES: ReadonlySet<CadStage> = new Set<CadStage>([
  "interessado","reuniao_agendada","proposta_enviada","negociacao","fechado","perdido",
]);

/**
 * Elegibilidade do lead para o próximo disparo de cadência.
 * - Outcome: nunca elegível (saiu da fila).
 * - next_action_at no futuro: bloqueado até a data.
 * - Caso contrário: elegível agora.
 */
export function leadElegivelParaDisparo(
  lead: Pick<CadLead, "stage" | "next_action_at">,
  now: Date = new Date(),
): { elegivel: boolean; motivo?: string; proximoEnvioAt?: Date } {
  if (CAD_OUTCOME_STAGES.has(lead.stage)) {
    return { elegivel: false, motivo: "Lead fora da cadência (mudou de status)." };
  }
  if (lead.next_action_at) {
    const next = new Date(lead.next_action_at);
    if (now.getTime() < next.getTime()) {
      return {
        elegivel: false,
        motivo: `Próximo disparo permitido em ${next.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.`,
        proximoEnvioAt: next,
      };
    }
  }
  return { elegivel: true };
}