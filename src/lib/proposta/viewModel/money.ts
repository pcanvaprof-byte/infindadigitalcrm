const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("pt-BR");

export function brl(value: number | null | undefined): string {
  return BRL.format(Number(value ?? 0));
}

export function pct(value: number | null | undefined, fractionDigits = 1): string {
  return `${Number(value ?? 0).toFixed(fractionDigits)}%`;
}

export function num(value: number | null | undefined): string {
  return NUM.format(Number(value ?? 0));
}

/**
 * Parcelamento sugerido: 1x, 3x, 6x, 12x sem juros sobre o implantacao + total mensal anualizado.
 * Heurística comercial — não é cálculo financeiro real.
 */
export function parcelasSugeridas(totalImplantacao: number, totalMensal: number) {
  const total = totalImplantacao + totalMensal * 12;
  return [
    { vezes: 1, valor: total },
    { vezes: 3, valor: total / 3 },
    { vezes: 6, valor: total / 6 },
    { vezes: 12, valor: total / 12 },
  ];
}

/** Dias restantes até a validade (negativo = expirada). */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const diff = target - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}