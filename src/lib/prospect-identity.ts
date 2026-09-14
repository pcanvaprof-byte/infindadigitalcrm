import type { Prospect } from "./mock-prospects";

/**
 * Gera uma chave de identidade para o prospect baseada em dados duráveis da empresa.
 * Usada para deduplicação, trava de 24h compartilhada por empresa e filtros de ocultação.
 */
export function getProspectIdentityKey(p: Partial<Prospect> | Record<string, any>): string {
  // 1. CNPJ normalizado (raiz de 8 dígitos se disponível)
  const cnpj = String(p.cnpj || "").replace(/\D/g, "");
  if (cnpj.length >= 8) {
    return `cnpj:${cnpj.slice(0, 8)}`;
  }

  // 2. WhatsApp normalizado
  const wa = String(p.whatsapp || "").replace(/\D/g, "");
  if (wa.length >= 10) {
    return `wa:${wa}`;
  }

  // 3. Nome + Cidade (fallback)
  const name = String(p.company || "").trim().toLowerCase();
  const city = String(p.city || "").trim().toLowerCase();
  if (name) {
    return `name:${name}|${city}`;
  }

  return `id:${p.id}`;
}

/**
 * Normaliza um telefone brasileiro para uma chave estável (somente dígitos, sem o 55).
 * Retorna null quando o número não é discável.
 */
export function normalizePhoneKey(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  if (isJunkPhone(d)) return null;
  return d;
}

/**
 * Números placeholder / inválidos que aparecem repetidos em bases importadas
 * (9999999999, 1111111111, 4711111111, sequências de um único dígito no assinante).
 */
export function isJunkPhone(raw: string | null | undefined): boolean {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return true;
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length < 10) return true;
  if (/^(\d)\1+$/.test(local)) return true;
  const subscriber = local.slice(2);
  if (/^(\d)\1+$/.test(subscriber)) return true;
  return false;
}

/** Telefones úteis (WhatsApp + telefone fixo) de um prospect, já normalizados. */
export function getProspectPhoneKeys(p: Partial<Prospect> | Record<string, any>): string[] {
  const out = new Set<string>();
  for (const raw of [p.whatsapp, (p as Record<string, unknown>).phone]) {
    const k = normalizePhoneKey(raw as string | null | undefined);
    if (k) out.add(k);
  }
  return [...out];
}

/**
 * Todas as chaves que caracterizam "já falei com esse contato": identidade da
 * empresa (CNPJ/nome) MAIS cada telefone. Empresas com CNPJ diferente que
 * compartilham o mesmo WhatsApp passam a bloquear uma à outra.
 */
export function getProspectBlockKeys(p: Partial<Prospect> | Record<string, any>): string[] {
  return [getProspectIdentityKey(p), ...getProspectPhoneKeys(p).map((k) => `tel:${k}`)];
}
