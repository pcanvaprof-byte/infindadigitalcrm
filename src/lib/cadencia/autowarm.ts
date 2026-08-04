/**
 * MOTOR DE AQUECIMENTO AUTOMÁTICO
 * ================================
 * Fluxo automático de aquecimento da base (9k+ leads) baseado em dois
 * gatilhos:
 *
 *  1. GATILHO DE TEMPO   → `next_action_at`. Cada estágio tem um intervalo
 *     em dias; ao completar o intervalo o lead volta para a fila do dia,
 *     respeitando janela de horário comercial e dias úteis.
 *  2. GATILHO DE STATUS  → `stage` / `last_response_at`. Quem responde sai
 *     da régua (outcome). Quem não responde avança de follow-up, esfria a
 *     temperatura e, após esgotar o último follow-up, é encerrado como
 *     perdido automaticamente.
 *
 * O motor não envia mensagens sozinho (o WhatsApp exige gesto do usuário):
 * ele mantém a régua sempre calculada e entrega a fila do dia pronta para
 * disparo em sequência ("piloto de aquecimento").
 */
import {
  CAD_OUTCOME_STAGES,
  CAD_STAGES,
  type CadLead,
  type CadStage,
  type CadTemp,
} from "./types";
import { listLeads, updateLead, moveStage, importFromProspects } from "./api";
import { supabase } from "@/integrations/supabase/client";

export const FOLLOWUP_STAGES = CAD_STAGES.filter((s) => s.startsWith("followup_")) as readonly CadStage[];

export type AutowarmConfig = {
  /** Motor ligado: fila do dia e recálculo automático ativos. */
  enabled: boolean;
  /** Teto de disparos por dia (proteção anti-bloqueio do WhatsApp). */
  dailyCap: number;
  /** Dias de espera após o disparo de cada follow-up. */
  intervals: Record<string, number>;
  /** Janela de disparo (hora local). */
  workStartHour: number;
  workEndHour: number;
  /** Só agenda em dias úteis (seg–sex). */
  weekdaysOnly: boolean;
  /** Dias sem resposta para esfriar o lead. */
  coolDays: number;
  /** Dias desde a última resposta para marcar como quente. */
  warmDays: number;
  /** Dias após o último follow-up sem resposta para encerrar como perdido. */
  dropAfterLastDays: number;
  /** Importar automaticamente novos prospectados para a régua. */
  autoImport: boolean;
  /** Quantidade de leads disparados em cada rodada do modo automático. */
  batchSize: number;
  /** Intervalo entre rodadas do modo automático (segundos). */
  batchIntervalSec: number;
};

export const DEFAULT_AUTOWARM_CONFIG: AutowarmConfig = {
  enabled: true,
  dailyCap: 60,
  intervals: {
    followup_1: 3,
    followup_2: 4,
    followup_3: 3,
    followup_4: 4,
    followup_5: 4,
    followup_6: 6,
    followup_7: 7,
  },
  workStartHour: 9,
  workEndHour: 18,
  weekdaysOnly: true,
  coolDays: 14,
  warmDays: 3,
  dropAfterLastDays: 10,
  autoImport: true,
  batchSize: 20,
  batchIntervalSec: 60,
};

const STORAGE_KEY = "autowarm_cfg_v1";

export function loadAutowarmConfig(): AutowarmConfig {
  if (typeof window === "undefined") return DEFAULT_AUTOWARM_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUTOWARM_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AutowarmConfig>;
    return {
      ...DEFAULT_AUTOWARM_CONFIG,
      ...parsed,
      intervals: { ...DEFAULT_AUTOWARM_CONFIG.intervals, ...(parsed.intervals ?? {}) },
    };
  } catch {
    return DEFAULT_AUTOWARM_CONFIG;
  }
}

export function saveAutowarmConfig(cfg: AutowarmConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

/** Disparos outbound já registrados hoje pelo usuário atual. */
export async function countSendsToday(): Promise<number> {
  const db = supabase as unknown as { from: (t: string) => any };
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return 0;
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const { count, error } = await db
    .from("cad_messages")
    .select("id", { count: "exact", head: true })
    .eq("author_id", uid)
    .eq("direction", "out")
    .gte("created_at", inicio.toISOString());
  if (error) return 0;
  return count ?? 0;
}

// ============================================================
// Cálculo de agenda (gatilho de tempo)
// ============================================================

/** Ajusta a data para a próxima janela válida (horário comercial / dia útil). */
export function nextValidSlot(date: Date, cfg: AutowarmConfig): Date {
  const d = new Date(date.getTime());
  const start = Math.max(0, Math.min(23, cfg.workStartHour));
  const end = Math.max(start + 1, Math.min(24, cfg.workEndHour));

  for (let guard = 0; guard < 14; guard++) {
    if (cfg.weekdaysOnly && (d.getDay() === 0 || d.getDay() === 6)) {
      d.setDate(d.getDate() + 1);
      d.setHours(start, 0, 0, 0);
      continue;
    }
    if (d.getHours() < start) {
      d.setHours(start, 0, 0, 0);
      return d;
    }
    if (d.getHours() >= end) {
      d.setDate(d.getDate() + 1);
      d.setHours(start, 0, 0, 0);
      continue;
    }
    return d;
  }
  return d;
}

/** Data do próximo toque a partir do último contato no estágio informado. */
export function computeNextActionAt(stage: CadStage, from: Date, cfg: AutowarmConfig): Date {
  const days = cfg.intervals[stage] ?? 3;
  const base = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  return nextValidSlot(base, cfg);
}

export function temTelefone(lead: CadLead): boolean {
  const w = (lead.whatsapp || "").replace(/\D/g, "");
  const t = (lead.telefone || "").replace(/\D/g, "");
  return w.length >= 10 || t.length >= 10;
}

function isFollowup(stage: CadStage): boolean {
  return stage.startsWith("followup_");
}

// ============================================================
// Planejamento da fila do dia
// ============================================================

export type AutowarmPlan = {
  /** Fila do dia já limitada pelo teto diário. */
  fila: CadLead[];
  /** Vencidos e elegíveis (antes do teto). */
  vencidos: number;
  /** Agendados para o futuro. */
  agendados: number;
  /** Sem data de próximo toque (o motor vai agendar). */
  semAgenda: number;
  /** Elegíveis mas sem telefone/WhatsApp. */
  semTelefone: number;
  /** Fora da régua (responderam / encerrados). */
  outcome: number;
  /** Total de leads na régua do usuário. */
  total: number;
  /** Estamos dentro da janela de disparo agora? */
  dentroDaJanela: boolean;
};

export function planAutowarm(
  leads: CadLead[],
  cfg: AutowarmConfig,
  now: Date = new Date(),
  jaEnviadosHoje = 0,
): AutowarmPlan {
  let vencidos = 0;
  let agendados = 0;
  let semAgenda = 0;
  let semTelefone = 0;
  let outcome = 0;
  const elegiveis: CadLead[] = [];

  for (const lead of leads) {
    if (CAD_OUTCOME_STAGES.has(lead.stage) || lead.closed_at) {
      outcome++;
      continue;
    }
    if (!temTelefone(lead)) {
      semTelefone++;
      continue;
    }
    if (!lead.next_action_at) {
      semAgenda++;
      elegiveis.push(lead);
      continue;
    }
    if (new Date(lead.next_action_at).getTime() <= now.getTime()) {
      vencidos++;
      elegiveis.push(lead);
    } else {
      agendados++;
    }
  }

  elegiveis.sort((a, b) => {
    const ta = a.next_action_at ? new Date(a.next_action_at).getTime() : 0;
    const tb = b.next_action_at ? new Date(b.next_action_at).getTime() : 0;
    if (ta !== tb) return ta - tb;
    const pesoTemp: Record<CadTemp, number> = { quente: 0, morno: 1, frio: 2 };
    return pesoTemp[a.temperatura] - pesoTemp[b.temperatura];
  });

  const restante = Math.max(0, cfg.dailyCap - jaEnviadosHoje);
  const hora = now.getHours();
  const dentroDaJanela =
    hora >= cfg.workStartHour &&
    hora < cfg.workEndHour &&
    (!cfg.weekdaysOnly || (now.getDay() !== 0 && now.getDay() !== 6));

  return {
    fila: elegiveis.slice(0, restante),
    vencidos,
    agendados,
    semAgenda,
    semTelefone,
    outcome,
    total: leads.length,
    dentroDaJanela,
  };
}

// ============================================================
// Execução do motor (gatilhos de tempo + status)
// ============================================================

export type AutowarmRunResult = {
  agendados: number;
  esfriados: number;
  aquecidos: number;
  encerrados: number;
  importados: number;
  analisados: number;
};

const MAX_WRITES_PER_RUN = 400;

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map((item) => fn(item).catch(() => undefined)));
  }
}

function dias(from: string | null | undefined, now: Date): number {
  if (!from) return Number.POSITIVE_INFINITY;
  return (now.getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Roda o motor: agenda quem está sem data, ajusta temperatura por tempo sem
 * resposta e encerra automaticamente quem esgotou o último follow-up.
 */
export async function runAutowarmEngine(cfg: AutowarmConfig): Promise<AutowarmRunResult> {
  const now = new Date();
  let importados = 0;
  if (cfg.autoImport) {
    try {
      const imp = await importFromProspects();
      importados = imp.imported;
    } catch {
      /* importação é best-effort */
    }
  }

  const leads = await listLeads();

  const paraAgendar: Array<{ id: string; next_action_at: string }> = [];
  const paraEsfriar: string[] = [];
  const paraAquecer: string[] = [];
  const paraEncerrar: string[] = [];

  for (const lead of leads) {
    if (CAD_OUTCOME_STAGES.has(lead.stage) || lead.closed_at) continue;
    if (!isFollowup(lead.stage)) continue;

    const semRespostaDias = dias(lead.last_response_at, now);
    const semContatoDias = dias(lead.last_contact_at ?? lead.primeira_abordagem_at, now);

    // GATILHO DE STATUS: esgotou o último follow-up e nunca respondeu.
    if (
      lead.stage === "followup_7" &&
      !lead.last_response_at &&
      semContatoDias >= cfg.dropAfterLastDays
    ) {
      paraEncerrar.push(lead.id);
      continue;
    }

    // GATILHO DE TEMPO: sem agenda → calcula a partir do último contato.
    if (!lead.next_action_at) {
      const base = lead.last_contact_at ? new Date(lead.last_contact_at) : now;
      paraAgendar.push({
        id: lead.id,
        next_action_at: computeNextActionAt(lead.stage, base, cfg).toISOString(),
      });
    }

    // Temperatura automática.
    if (lead.last_response_at && semRespostaDias <= cfg.warmDays && lead.temperatura !== "quente") {
      paraAquecer.push(lead.id);
    } else if (!lead.last_response_at && semContatoDias >= cfg.coolDays && lead.temperatura !== "frio") {
      paraEsfriar.push(lead.id);
    }
  }

  const agendar = paraAgendar.slice(0, MAX_WRITES_PER_RUN);
  const esfriar = paraEsfriar.slice(0, MAX_WRITES_PER_RUN);
  const aquecer = paraAquecer.slice(0, MAX_WRITES_PER_RUN);
  const encerrar = paraEncerrar.slice(0, 100);

  await pool(agendar, 8, (item) => updateLead(item.id, { next_action_at: item.next_action_at }).then(() => undefined));
  await pool(esfriar, 8, (id) => updateLead(id, { temperatura: "frio" }).then(() => undefined));
  await pool(aquecer, 8, (id) => updateLead(id, { temperatura: "quente" }).then(() => undefined));
  await pool(encerrar, 4, async (id) => {
    await moveStage(id, "perdido");
    await updateLead(id, { closed_reason: "Sem resposta após o último follow-up (aquecimento automático)" });
  });

  return {
    agendados: agendar.length,
    esfriados: esfriar.length,
    aquecidos: aquecer.length,
    encerrados: encerrar.length,
    importados,
    analisados: leads.length,
  };
}
