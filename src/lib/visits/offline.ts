/**
 * Fila offline de check-ins de visita (PAP).
 * Guarda os check-ins feitos sem sinal e reenvia quando a conexão voltar.
 */

export type QueuedVisit = {
  qid: string;
  cnpj: string;
  company: string;
  status: string;
  resultado?: string | null;
  observacoes?: string | null;
  contato_nome?: string | null;
  retornar_em?: string | null;
  lat?: number | null;
  lon?: number | null;
  endereco_snapshot?: string | null;
  visited_at: string;
};

const KEY = "pap.visits.queue.v1";

function read(): QueuedVisit[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as QueuedVisit[];
  } catch {
    return [];
  }
}

function write(list: QueuedVisit[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("pap-visits-queue:changed"));
}

export function listQueue(): QueuedVisit[] {
  return read();
}

export function queueSize(): number {
  return read().length;
}

export function enqueueVisit(v: Omit<QueuedVisit, "qid">): QueuedVisit {
  const item: QueuedVisit = { ...v, qid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  write([...read(), item]);
  return item;
}

export function dequeueVisit(qid: string) {
  write(read().filter((v) => v.qid !== qid));
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}