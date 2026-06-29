import { z } from "zod";

export const PERIOD_KEYS = [
  "hoje",
  "semana",
  "mes",
  "trimestre",
  "30d",
  "90d",
  "custom",
] as const;

export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const periodSearchSchema = z.object({
  period: z.enum(PERIOD_KEYS).default("mes"),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type PeriodSearch = z.infer<typeof periodSearchSchema>;

export interface ResolvedPeriod {
  key: PeriodKey;
  from: Date;
  to: Date;
  /** Dias inclusivos no range (mínimo 1) */
  days: number;
  /** Label curto pt-BR (ex: "Este mês") */
  label: string;
  /** Descrição com datas (ex: "01/06 → 28/06") */
  rangeLabel: string;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Segunda como início da semana (ISO). */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return endOfDay(e);
}
function startOfMonth(d: Date) {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}
function endOfMonth(d: Date) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return startOfDay(new Date(d.getFullYear(), q, 1));
}
function endOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return endOfDay(new Date(d.getFullYear(), q + 3, 0));
}

const fmtDM = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Este trimestre",
  "30d": "30 dias",
  "90d": "90 dias",
  custom: "Personalizado",
};

export function resolvePeriod(
  key: PeriodKey,
  from?: string,
  to?: string,
): ResolvedPeriod {
  const now = new Date();
  let f: Date;
  let t: Date;

  switch (key) {
    case "hoje":
      f = startOfDay(now);
      t = endOfDay(now);
      break;
    case "semana":
      f = startOfWeek(now);
      t = endOfWeek(now);
      break;
    case "mes":
      f = startOfMonth(now);
      t = endOfMonth(now);
      break;
    case "trimestre":
      f = startOfQuarter(now);
      t = endOfQuarter(now);
      break;
    case "30d":
      t = endOfDay(now);
      f = startOfDay(new Date(now.getTime() - 29 * 86400000));
      break;
    case "90d":
      t = endOfDay(now);
      f = startOfDay(new Date(now.getTime() - 89 * 86400000));
      break;
    case "custom": {
      const cf = from ? new Date(from) : startOfMonth(now);
      const ct = to ? new Date(to) : endOfDay(now);
      f = startOfDay(cf);
      t = endOfDay(ct);
      if (t < f) [f, t] = [t, f];
      break;
    }
  }

  const days = Math.max(
    1,
    Math.round((endOfDay(t).getTime() - startOfDay(f).getTime()) / 86400000) + 1,
  );

  return {
    key,
    from: f,
    to: t,
    days,
    label: PERIOD_LABEL[key],
    rangeLabel: `${fmtDM(f)} → ${fmtDM(t)}`,
  };
}

/** Multiplica uma meta proporcionalmente ao tamanho do período vs 30 dias. */
export function scaleGoal(monthlyGoal: number, period: ResolvedPeriod) {
  return Math.max(0, Math.round(monthlyGoal * monthlyFactor(period)));
}

/** Fator multiplicador para converter uma meta mensal no período resolvido. */
export function monthlyFactor(period: ResolvedPeriod): number {
  switch (period.key) {
    case "hoje":
      // Distribui a meta mensal pelos dias úteis (~22) do mês.
      return 1 / 22;
    case "semana":
      // 4.345 semanas em um mês médio.
      return 1 / 4.345;
    case "mes":
    case "30d":
      return 1;
    case "trimestre":
    case "90d":
      return 3;
    case "custom":
    default:
      return period.days / 30;
  }
}

/** Converte uma meta semanal no escopo do período (semana é a base). */
export function scaleWeeklyGoal(weeklyGoal: number, period: ResolvedPeriod) {
  // Semana = base; mês = 4.345 semanas; trimestre = 13.04; dia = 1/5 da semana.
  const factorByKey: Record<PeriodKey, number> = {
    hoje: 1 / 5,
    semana: 1,
    mes: 4.345,
    trimestre: 13.04,
    "30d": 4.345,
    "90d": 13.04,
    custom: period.days / 7,
  };
  return Math.max(0, Math.round(weeklyGoal * factorByKey[period.key]));
}

/** Rótulo curto do escopo da meta de acordo com o período. */
export function goalScopeLabel(period: ResolvedPeriod): string {
  switch (period.key) {
    case "hoje":      return "do dia";
    case "semana":    return "da semana";
    case "mes":       return "do mês";
    case "trimestre": return "do trimestre";
    case "30d":       return "dos últimos 30 dias";
    case "90d":       return "dos últimos 90 dias";
    case "custom":    return "do período";
  }
}
