// Persistent ring buffer for `[lifecycle-link]` events so a UI panel can
// audit which abas vincularam/repararam clientes. Roda no browser apenas
// (usa localStorage). Mantém os últimos N eventos para evitar crescer sem
// limite.

const KEY = "infinda:lifecycle-link-audit:v1";
const MAX = 500;

export type LifecycleLinkStep =
  | "open:start"
  | "open:match-source_ref"
  | "open:match-company"
  | "open:repair-source_ref"
  | "open:created"
  | "open:navigate"
  | "open:error";

export interface LifecycleLinkEvent {
  ts: string;
  step: LifecycleLinkStep | string;
  op_cliente_id?: string;
  nome?: string;
  empresa?: string;
  lc_id?: string;
  previous_source_ref?: string | null;
  stage?: string;
  error?: string;
  [k: string]: unknown;
}

function read(): LifecycleLinkEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LifecycleLinkEvent[]) : [];
  } catch {
    return [];
  }
}

function write(list: LifecycleLinkEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    window.dispatchEvent(new CustomEvent("lifecycle-link:log"));
  } catch {
    /* quota or private mode → ignore */
  }
}

export function pushLifecycleLog(
  step: LifecycleLinkStep | string,
  payload: Record<string, unknown> = {},
) {
  const ev: LifecycleLinkEvent = {
    ts: new Date().toISOString(),
    step,
    ...payload,
  };
  // mantém o console.info para devs com DevTools abertos
  // (mesmo formato de antes para compat de greps existentes)
  // eslint-disable-next-line no-console
  console.info(`[lifecycle-link] ${step}`, ev);
  const list = read();
  list.push(ev);
  write(list);
}

export function listLifecycleLogs(filter?: {
  source_ref?: string;
  q?: string;
}): LifecycleLinkEvent[] {
  let list = read().slice().reverse();
  if (filter?.source_ref) {
    list = list.filter((e) => e.op_cliente_id === filter.source_ref);
  }
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    list = list.filter((e) =>
      JSON.stringify(e).toLowerCase().includes(q),
    );
  }
  return list;
}

export function clearLifecycleLogs() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("lifecycle-link:log"));
}

export const LIFECYCLE_LOG_EVENT = "lifecycle-link:log";