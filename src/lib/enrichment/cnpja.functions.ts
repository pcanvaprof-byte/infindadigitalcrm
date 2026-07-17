import { createServerFn } from "@tanstack/react-start";
import { authWithAccess } from "@/lib/access/auth-with-access";

// CNPJá Open (free tier): 5 req/min por IP. Mantemos folga e usamos 4 req/min.
// Janela deslizante simples em memória do worker.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4;
const calls: number[] = [];

function tryConsume(): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  while (calls.length && now - calls[0] > WINDOW_MS) calls.shift();
  if (calls.length >= MAX_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - calls[0]) + 50;
    return { ok: false, retryAfterMs };
  }
  calls.push(now);
  return { ok: true, retryAfterMs: 0 };
}

export const fetchCnpjaCompany = createServerFn({ method: "POST" })
  .middleware([authWithAccess])
  .inputValidator((input: { cnpj: string }) => {
    const cnpj = (input?.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) throw new Error("CNPJ inválido");
    return { cnpj };
  })
  .handler(async ({ data }) => {
    const token = process.env.CNPJA_API_TOKEN;
    if (!token) {
      return { ok: false as const, status: 0, error: "CNPJA_API_TOKEN ausente" };
    }
    const gate = tryConsume();
    if (!gate.ok) {
      return {
        ok: false as const,
        status: 429,
        error: "Limite gratuito do CNPJá atingido (4/min). Tente novamente em alguns segundos.",
        retryAfterMs: gate.retryAfterMs,
      };
    }
    try {
      const r = await fetch(`https://api.cnpja.com/office/${data.cnpj}?simples=false`, {
        headers: { Authorization: token },
      });
      const text = await r.text();
      if (!r.ok) {
        return { ok: false as const, status: r.status, error: text.slice(0, 300) };
      }
      return { ok: true as const, status: 200, data: JSON.parse(text) };
    } catch (e) {
      return { ok: false as const, status: 0, error: (e as Error).message };
    }
  });