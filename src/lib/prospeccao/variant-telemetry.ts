/**
 * Telemetria de variantes de mensagem — registra qual variante foi
 * escolhida em cada disparo (Prospecção, Cadência, Nicho) para debug
 * e auditoria. Grava em três canais:
 *
 * 1. `console.info("[variant]", ...)` — inspecionável no DevTools.
 * 2. Ring buffer em `localStorage` (últimos 200 picks) — chave
 *    `variant_log:v1`. Sobrevive ao refresh.
 * 3. `window.__variantLog` — helpers em runtime pra ler/limpar
 *    (`window.__variantLog.list()` / `.clear()`).
 *
 * Não faz round-trip com o servidor: se precisarmos escalar pra
 * telemetria persistida, o payload já está pronto pra ser POSTado.
 */
import {
  splitVariants,
  expandVariants,
  pickVariantIndex,
} from "@/lib/cadencia/types";

export type VariantSource = "explicit" | "auto" | "single";
export type VariantScope = "pack" | "niche" | "cadencia";

export interface VariantPickMeta {
  scope: VariantScope;
  bucketKey: string;
  pack?: string | null;
  stage?: string | null;
  niche?: string | null;
  prospectId?: string | null;
  leadId?: string | null;
  company?: string | null;
}

export interface VariantPickResult {
  text: string;
  index: number;
  total: number;
  source: VariantSource;
}

export interface VariantLogEntry extends VariantPickMeta, VariantPickResult {
  at: string; // ISO
  textHash: string;
  textPreview: string;
}

const LOG_KEY = "variant_log:v1";
const LOG_LIMIT = 200;

function hashText(s: string): string {
  // FNV-1a 32-bit — suficiente pra correlacionar disparos, não é segurança.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function safeWrite(entry: VariantLogEntry) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const raw = window.localStorage.getItem(LOG_KEY);
    const arr: VariantLogEntry[] = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    if (arr.length > LOG_LIMIT) arr.splice(0, arr.length - LOG_LIMIT);
    window.localStorage.setItem(LOG_KEY, JSON.stringify(arr));
  } catch {
    /* storage cheio / quota — ignora, telemetria é best-effort */
  }
}

export function readVariantLog(): VariantLogEntry[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as VariantLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearVariantLog() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(LOG_KEY);
  } catch { /* ignore */ }
}

// Expõe helpers de debug no window sem poluir tipos globais.
if (typeof window !== "undefined") {
  (window as unknown as { __variantLog?: unknown }).__variantLog = {
    list: readVariantLog,
    clear: clearVariantLog,
  };
}

/**
 * Escolhe a variante a enviar e registra o pick.
 *
 * - Se o corpo tem variantes explícitas (`---`), usa-as (source="explicit").
 * - Senão tenta gerar variações naturais via `expandVariants` (source="auto").
 * - Se nem isso rende múltiplas versões, devolve o corpo cru (source="single").
 *
 * O índice é escolhido por round-robin persistido em `bucketKey`.
 */
export function chooseVariant(
  corpo: string,
  meta: VariantPickMeta,
): VariantPickResult {
  const explicit = splitVariants(corpo);
  let variants: string[];
  let source: VariantSource;
  if (explicit.length > 1) {
    variants = explicit;
    source = "explicit";
  } else {
    const auto = expandVariants(corpo);
    if (auto.length > 1) {
      variants = auto;
      source = "auto";
    } else {
      variants = auto.length ? auto : [corpo];
      source = "single";
    }
  }
  const index =
    variants.length > 1 ? pickVariantIndex(variants.length, meta.bucketKey) : 0;
  const text = variants[index] ?? corpo;

  const entry: VariantLogEntry = {
    ...meta,
    source,
    index,
    total: variants.length,
    text,
    textHash: hashText(text),
    textPreview: text.slice(0, 80),
    at: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.info("[variant]", {
    scope: meta.scope,
    source,
    index,
    total: variants.length,
    bucket: meta.bucketKey,
    pack: meta.pack ?? undefined,
    stage: meta.stage ?? undefined,
    niche: meta.niche ?? undefined,
    prospectId: meta.prospectId ?? undefined,
    hash: entry.textHash,
    preview: entry.textPreview,
  });
  safeWrite(entry);

  return { text, index, total: variants.length, source };
}