// Handoff entre o pop-up "Configure seu negócio" (prospecção) e /meu-negocio.
// Guarda para onde voltar e qual disparo estava pendente, para que ao concluir
// o preenchimento o usuário retorne sozinho ao fluxo de disparos.
const KEY = "infinda:biz-return";

export type BizReturn = { to: string; prospectId?: string; at: number };

// Handoff só vale por poucos minutos — evita "voltar" numa sessão antiga.
const MAX_AGE_MS = 30 * 60 * 1000;

export function setBizReturn(data: Omit<BizReturn, "at">) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...data, at: Date.now() }));
  } catch { /* storage indisponível: fluxo segue manual */ }
}

export function peekBizReturn(): BizReturn | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BizReturn;
    if (!parsed?.to || Date.now() - (parsed.at ?? 0) > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function consumeBizReturn(): BizReturn | null {
  const data = peekBizReturn();
  if (typeof window !== "undefined") {
    try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
  }
  return data;
}

// ── Flag "já configurei" ────────────────────────────────────────────────
// Depois que o perfil do negócio fica pronto para disparos, marcamos por
// usuário (localStorage) para o pop-up nunca mais aparecer nesse navegador.
const DONE_KEY = "infinda:biz-gate-done";

const doneKey = (userId: string) => `${DONE_KEY}:${userId}`;

export function isBizGateDone(userId?: string | null): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    return localStorage.getItem(doneKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markBizGateDone(userId?: string | null) {
  if (typeof window === "undefined" || !userId) return;
  try { localStorage.setItem(doneKey(userId), "1"); } catch { /* noop */ }
}

export function clearBizGateDone(userId?: string | null) {
  if (typeof window === "undefined" || !userId) return;
  try { localStorage.removeItem(doneKey(userId)); } catch { /* noop */ }
}
