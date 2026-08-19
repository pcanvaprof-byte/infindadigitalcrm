import type { Prospect } from "./prospects-api";

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
