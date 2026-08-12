/** Filtro por data de abertura do CNPJ (faixas rápidas + intervalo). */

export type OpeningRange = "all" | "lt1" | "1a3" | "3a10" | "gt10";

export const OPENING_RANGES: { id: OpeningRange; label: string }[] = [
  { id: "all", label: "Qualquer data" },
  { id: "lt1", label: "Até 1 ano" },
  { id: "1a3", label: "1 a 3 anos" },
  { id: "3a10", label: "3 a 10 anos" },
  { id: "gt10", label: "+10 anos" },
];

export interface OpeningFilter {
  range: OpeningRange;
  from?: string; // yyyy-mm-dd
  to?: string;   // yyyy-mm-dd
}

export const EMPTY_OPENING_FILTER: OpeningFilter = { range: "all", from: "", to: "" };

export function isOpeningFilterActive(f: OpeningFilter): boolean {
  return f.range !== "all" || !!f.from || !!f.to;
}

function yearsSince(d: Date): number {
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

/** true = mantém o lead. Leads sem data são removidos quando o filtro está ativo. */
export function matchesOpening(dateStr: string | null | undefined, f: OpeningFilter): boolean {
  if (!isOpeningFilterActive(f)) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  if (f.from && d < new Date(`${f.from}T00:00:00`)) return false;
  if (f.to && d > new Date(`${f.to}T23:59:59`)) return false;

  const anos = yearsSince(d);
  switch (f.range) {
    case "lt1": return anos < 1;
    case "1a3": return anos >= 1 && anos < 3;
    case "3a10": return anos >= 3 && anos < 10;
    case "gt10": return anos >= 10;
    default: return true;
  }
}

export function formatOpening(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

export function marketAgeLabel(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const anos = Math.floor(yearsSince(d));
  if (anos < 1) return "< 1 ano";
  return `${anos} ano${anos > 1 ? "s" : ""}`;
}
