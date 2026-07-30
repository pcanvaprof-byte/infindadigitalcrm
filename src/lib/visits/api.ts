import { supabase } from "@/integrations/supabase/client";
import {
  dequeueVisit,
  enqueueVisit,
  isOnline,
  listQueue,
  type QueuedVisit,
} from "./offline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const VISIT_STATUSES = [
  "Planejada",
  "Visitado",
  "Reagendar",
  "Sem sucesso",
  "Fechado",
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export interface Visit {
  id: string;
  cnpj: string | null;
  status: VisitStatus | string;
  resultado: string | null;
  observacoes: string | null;
  contato_nome: string | null;
  retornar_em: string | null;
  visited_at: string;
  user_id: string;
}

/** Cores por status — usadas nos pins do mapa e nas legendas. */
export const VISIT_COLORS: Record<string, string> = {
  "não visitado": "#94a3b8", // cinza
  Planejada: "#f59e0b", // âmbar
  Visitado: "#2563eb", // azul
  Reagendar: "#a855f7", // roxo
  "Sem sucesso": "#ef4444", // vermelho
  Fechado: "#16a34a", // verde
};

export function visitColor(status?: string | null): string {
  if (!status) return VISIT_COLORS["não visitado"];
  return VISIT_COLORS[status] ?? VISIT_COLORS["não visitado"];
}

export const visitKeys = {
  all: ["company_visits"] as const,
};

const CACHE_KEY = "pap.visits.cache.v1";

function cacheWrite(map: Record<string, Visit>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
function cacheRead(): Record<string, Visit> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<string, Visit>;
  } catch {
    return {};
  }
}

/** Última visita por CNPJ (visível conforme RLS: própria + organização). */
export async function loadLatestVisitsByCnpj(): Promise<Record<string, Visit>> {
  if (!isOnline()) return cacheRead();
  const { data, error } = await db
    .from("company_visits")
    .select("id,cnpj,status,resultado,observacoes,contato_nome,retornar_em,visited_at,user_id")
    .order("visited_at", { ascending: false })
    .limit(5000);
  if (error) {
    const cached = cacheRead();
    if (Object.keys(cached).length) return cached;
    throw error;
  }
  const map: Record<string, Visit> = {};
  for (const row of (data ?? []) as Visit[]) {
    const key = onlyDigits(row.cnpj);
    if (!key || map[key]) continue;
    map[key] = row;
  }
  cacheWrite(map);
  return map;
}

export function onlyDigits(v?: string | null): string {
  return (v ?? "").replace(/\D/g, "");
}

export interface CheckinInput {
  cnpj: string;
  company: string;
  status: VisitStatus;
  resultado?: string | null;
  observacoes?: string | null;
  contato_nome?: string | null;
  retornar_em?: string | null;
  lat?: number | null;
  lon?: number | null;
  endereco_snapshot?: string | null;
}

async function insertVisit(v: Omit<QueuedVisit, "qid">) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Sessão expirada. Faça login novamente.");

  // tenta vincular ao prospect da organização (opcional)
  let prospect_id: string | null = null;
  try {
    const { data } = await db
      .from("prospects")
      .select("id,cnpj")
      .limit(1000);
    const digits = onlyDigits(v.cnpj);
    const hit = ((data ?? []) as { id: string; cnpj: string | null }[]).find(
      (p) => onlyDigits(p.cnpj) === digits,
    );
    prospect_id = hit?.id ?? null;
  } catch {
    /* opcional */
  }

  const { error } = await db.from("company_visits").insert({
    user_id: uid,
    cnpj: v.cnpj,
    prospect_id,
    status: v.status,
    resultado: v.resultado ?? null,
    observacoes: v.observacoes ?? null,
    contato_nome: v.contato_nome ?? null,
    retornar_em: v.retornar_em ?? null,
    lat: v.lat ?? null,
    lon: v.lon ?? null,
    endereco_snapshot: v.endereco_snapshot ?? null,
    visited_at: v.visited_at,
  });
  if (error) throw error;
}

/**
 * Registra um check-in. Sem sinal (ou em caso de falha de rede),
 * o registro entra na fila offline e é reenviado depois.
 */
export async function registerCheckin(
  input: CheckinInput,
): Promise<{ queued: boolean }> {
  const payload: Omit<QueuedVisit, "qid"> = {
    ...input,
    visited_at: new Date().toISOString(),
  };

  if (!isOnline()) {
    enqueueVisit(payload);
    return { queued: true };
  }
  try {
    await insertVisit(payload);
    return { queued: false };
  } catch (e) {
    // erro de rede → guarda offline; erro de permissão/validação → propaga
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed")) {
      enqueueVisit(payload);
      return { queued: true };
    }
    throw e;
  }
}

/** Reenvia todos os check-ins pendentes. Retorna quantos foram enviados. */
export async function flushVisitQueue(): Promise<number> {
  if (!isOnline()) return 0;
  const queue = listQueue();
  let sent = 0;
  for (const item of queue) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { qid, ...rest } = item;
      await insertVisit(rest);
      dequeueVisit(item.qid);
      sent++;
    } catch {
      break; // ainda sem conexão estável — tenta novamente depois
    }
  }
  return sent;
}