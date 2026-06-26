import { supabase } from "@/integrations/supabase/client";
// Os tipos gerados (src/integrations/supabase/types.ts) ainda não conhecem
// as tabelas/RPCs da Fase 6 — a migration precisa ser executada e os tipos
// regerados. Até lá, usamos um cliente afrouxado APENAS para os novos pontos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ============================================================
// Cadência comercial — Fase 6
// Fonte única: tabela prospect_touchpoints + RPCs dashboard_metrics,
// acoes_hoje, snooze_prospect, close_cadence.
// Nenhum cálculo client-side de KPI.
// ============================================================

export type TouchpointTipo = "whatsapp" | "ligacao" | "email" | "reuniao" | "nota";
export type TouchpointResultado =
  | "enviado"
  | "respondido"
  | "interessado"
  | "sem_interesse"
  | "sem_resposta";

export type CadenceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type CadenceStatus = "ativo" | "pausado" | "encerrado";
export type ResponseStatus =
  | "sem_resposta"
  | "respondeu"
  | "interessado"
  | "sem_interesse"
  | "cliente";

export const CADENCE_STEP_LABEL: Record<CadenceStep, string> = {
  0: "Novo",
  1: "D+1",
  2: "D+3",
  3: "D+7",
  4: "D+15",
  5: "D+21",
  6: "Encerrado",
};

// Templates editáveis no front, mas o "step" é canônico (vem do banco).
export const CADENCE_TEMPLATES: Record<CadenceStep, string> = {
  0: "Olá! Sou {owner} da INFINDA. Identifiquei oportunidades específicas para a {company} e gostaria de conversar 5 minutos com você.",
  1: "Olá, tudo bem? Ontem tentei contato porque identifiquei oportunidades para sua empresa. Faz sentido conversarmos esta semana?",
  2: "Passando para reforçar minha mensagem anterior. Tenho algumas ideias que podem ajudar sua empresa. Vale uma conversa rápida?",
  3: "Imagino que a semana tenha sido corrida. Antes de encerrar meu contato, gostaria de saber se faz sentido conversarmos.",
  4: "Acredito que ainda posso contribuir com alguns insights para sua operação. Posso retornar mais adiante?",
  5: "Este será meu último contato por enquanto. Caso tenha interesse no futuro, fico à disposição.",
  6: "",
};

export interface Touchpoint {
  id: string;
  prospect_id: string;
  user_id: string;
  tipo: TouchpointTipo;
  mensagem: string | null;
  resultado: TouchpointResultado;
  enviado_em: string;
  created_at: string;
}

export interface AcaoHoje {
  id: string;
  company: string;
  whatsapp: string | null;
  cadence_step: CadenceStep;
  last_contact_at: string | null;
  next_contact_at: string | null;
  dias_atraso: number;
}

export interface DashboardMetrics {
  contatos:  { hoje: number; semana: number; mes: number };
  respostas: { hoje: number; semana: number; mes: number; taxa: number };
  resumo: {
    base: number;
    contatados: number;
    respondidos: number;
    interessados: number;
    em_negociacao: number;
    ativos: number;
    perdidos: number;
  };
  pipeline: Partial<Record<
    "PROSPECCAO" | "CADENCIA" | "FECHADO" | "REUNIAO_INICIAL" | "PROPOSTA"
    | "CONTRATO" | "ASSINATURA" | "PAGAMENTO_CONFIRMADO" | "IMPLANTACAO"
    | "ATIVO" | "CHURNED" | "PERDIDO",
    number
  >>;
  gargalos: {
    cadencia_atrasada: number;
    parados_30d: number;
    sem_responsavel: number;
    clients_parados_15d: number;
    sem_proxima_acao: number;
  };
  conversao: {
    base_contato: number;
    contato_resposta: number;
    resposta_interesse: number;
    interesse_proposta: number;
    proposta_ativo: number;
  };
}

export const cadenceKeys = {
  dashboard: ["cadence", "dashboard"] as const,
  acoesHoje: ["cadence", "acoes-hoje"] as const,
  timeline: (prospectId: string) => ["cadence", "timeline", prospectId] as const,
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error("Sessão expirada — entre novamente.");
  return id;
}

/** Lista touchpoints de um prospect (timeline). */
export async function listTouchpoints(prospectId: string): Promise<Touchpoint[]> {
  const { data, error } = await sb
    .from("prospect_touchpoints")
    .select("*")
    .eq("prospect_id", prospectId)
    // Eventos 'status' aparecem no histórico do card (p.interactions),
    // não na timeline da cadência — mantém a timeline limpa.
    .neq("tipo", "status")
    .order("enviado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Touchpoint[];
}

/** Insere touchpoint. Trigger no banco avança cadência + atualiza prospect. */
export async function addTouchpoint(input: {
  prospect_id: string;
  tipo: TouchpointTipo | "resposta";
  mensagem?: string | null;
  resultado: TouchpointResultado;
}): Promise<Touchpoint> {
  console.log("[cadence-api] addTouchpoint:start", input);
  const user_id = await uid();
  const { data, error } = await sb
    .from("prospect_touchpoints")
    .insert({
      prospect_id: input.prospect_id,
      user_id,
      tipo: input.tipo,
      mensagem: input.mensagem ?? null,
      resultado: input.resultado,
    })
    .select()
    .single();
  if (error) {
    console.error("[cadence-api] addTouchpoint:error", { input, error });
    throw error;
  }
  console.log("[cadence-api] addTouchpoint:ok", { id: (data as Touchpoint)?.id });
  return data as Touchpoint;
}

/**
 * Registra uma RESPOSTA inbound (cliente respondeu por wpp/ligação/email).
 * Conta na taxa de resposta do dashboard e marca o prospect como respondido,
 * mas NÃO avança a cadência (trigger trata).
 */
export async function registerResponse(
  prospectId: string,
  canal: "whatsapp" | "ligacao" | "email" | "outro" = "whatsapp",
  mensagem?: string,
): Promise<Touchpoint> {
  const user_id = await uid();
  const { data, error } = await sb
    .from("prospect_touchpoints")
    .insert({
      prospect_id: prospectId,
      user_id,
      tipo: "resposta",
      mensagem: mensagem ?? `Resposta recebida (${canal})`,
      resultado: "respondido",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Touchpoint;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await sb.rpc("dashboard_metrics");
  if (error) throw error;
  return data as unknown as DashboardMetrics;
}

export async function fetchAcoesHoje(limit = 100): Promise<AcaoHoje[]> {
  const { data, error } = await sb.rpc("acoes_hoje", { _limit: limit });
  if (error) throw error;
  return (data ?? []) as AcaoHoje[];
}

export async function snoozeProspect(prospectId: string, days: number): Promise<string> {
  const { data, error } = await sb.rpc("snooze_prospect", {
    _prospect_id: prospectId,
    _days: days,
  });
  if (error) throw error;
  return data as unknown as string;
}

export type CloseReason =
  | "sem_interesse"
  | "numero_invalido"
  | "empresa_fechada"
  | "cliente"
  | "outro";

export const CLOSE_REASON_LABEL: Record<CloseReason, string> = {
  sem_interesse: "Sem interesse",
  numero_invalido: "Número inválido",
  empresa_fechada: "Empresa fechada",
  cliente: "Cliente fechado",
  outro: "Outro",
};

export async function closeCadence(
  prospectId: string,
  reason: CloseReason,
  note?: string,
): Promise<void> {
  const { error } = await sb.rpc("close_cadence", {
    _prospect_id: prospectId,
    _reason: reason,
    _note: note ?? null,
  });
  if (error) throw error;
}

// ----- helpers de UI ------------------------------------------------------

/** Próxima ação textual a partir do next_contact_at (timezone do navegador). */
export function proximaAcaoLabel(nextIso: string | null | undefined): {
  text: string;
  tone: "overdue" | "today" | "tomorrow" | "soon" | "later" | "none";
} {
  if (!nextIso) return { text: "—", tone: "none" };
  const next = new Date(nextIso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextDay = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const diffDays = Math.round((nextDay.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays < 0) return { text: `Atrasado há ${-diffDays} dia${-diffDays > 1 ? "s" : ""}`, tone: "overdue" };
  if (diffDays === 0) return { text: "Hoje", tone: "today" };
  if (diffDays === 1) return { text: "Amanhã", tone: "tomorrow" };
  if (diffDays <= 7) return { text: `Em ${diffDays} dias`, tone: "soon" };
  return { text: `Em ${diffDays} dias`, tone: "later" };
}