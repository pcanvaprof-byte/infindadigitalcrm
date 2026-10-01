// Utilitários de nome de cidade compartilhados entre Prospecção e Mapa.
// Lida com bases sujas onde a cidade veio como número, CEP ou código IBGE.

/** Normaliza para comparação: sem acento, minúsculo, espaços colapsados. */
export function normalizeCity(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Exibição limpa: trim + espaços colapsados, mantendo acentos. */
export function cleanCityLabel(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Cidade válida = tem ao menos 2 letras e não é só número/CEP/código.
 * Exemplos inválidos: "1234", "0", "-", "89201-000", "4205407".
 */
export function isValidCityName(raw: string | null | undefined): boolean {
  const v = cleanCityLabel(raw);
  if (!v) return false;
  const letters = v.replace(/[^A-Za-zÀ-ú]/g, "");
  if (letters.length < 2) return false;
  // "89201-000 SC" e similares: se os dígitos dominam o texto, trate como inválido.
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 5 && digits.length >= letters.length) return false;
  return true;
}

export const INVALID_CITY_KEY = "__invalid__";

/** Exibição segura: esconde cidade inválida (número/CEP) em vez de mostrar. */
export function cityDisplay(raw: string | null | undefined): string {
  const v = cleanCityLabel(raw);
  return isValidCityName(v) ? v : "";
}
