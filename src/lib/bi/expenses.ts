/**
 * Despesas operacionais — armazenamento local enquanto não há tabela definitiva.
 * Usado por Business > Configurações Operacionais.
 */

export type ExpenseKind = "pessoal" | "infra" | "veiculo" | "outro";

export interface OperationalExpense {
  id: string;
  name: string;
  amount: number;
  kind: ExpenseKind;
  recurring: boolean;
}

const KEY = "bi.expenses.v1";
export const EXPENSES_EVENT = "bi-expenses-changed";

export const DEFAULT_EXPENSES: OperationalExpense[] = [
  { id: "exp-denise",   name: "Denise",   amount: 100,  kind: "pessoal", recurring: true },
  { id: "exp-lindomar", name: "Lindomar", amount: 135,  kind: "pessoal", recurring: true },
  { id: "exp-kakau",    name: "Kakau",    amount: 400,  kind: "pessoal", recurring: true },
  { id: "exp-daniela",  name: "Daniela",  amount: 400,  kind: "pessoal", recurring: true },
  { id: "exp-leno",     name: "Leno",     amount: 500,  kind: "pessoal", recurring: true },
  { id: "exp-elves",    name: "Elves",    amount: 400,  kind: "pessoal", recurring: true },
  { id: "exp-carro",    name: "Carro",    amount: 7000, kind: "veiculo", recurring: true },
  { id: "exp-edinaldo", name: "Edinaldo", amount: 1500, kind: "pessoal", recurring: true },
  { id: "exp-dom",      name: "Dom",      amount: 500,  kind: "pessoal", recurring: true },
];

function safeParse(raw: string | null): OperationalExpense[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    return v
      .filter((x) => x && typeof x === "object")
      .map((x: any) => ({
        id: String(x.id ?? crypto.randomUUID()),
        name: String(x.name ?? "").slice(0, 80),
        amount: Number.isFinite(Number(x.amount)) ? Math.max(0, Number(x.amount)) : 0,
        kind: (["pessoal", "infra", "veiculo", "outro"] as ExpenseKind[]).includes(x.kind) ? x.kind : "outro",
        recurring: Boolean(x.recurring),
      }));
  } catch {
    return null;
  }
}

export function readExpenses(): OperationalExpense[] {
  if (typeof window === "undefined") return DEFAULT_EXPENSES;
  const parsed = safeParse(window.localStorage.getItem(KEY));
  return parsed ?? DEFAULT_EXPENSES;
}

export function writeExpenses(list: OperationalExpense[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EXPENSES_EVENT, { detail: list }));
}

export function totalExpenses(list = readExpenses()): number {
  return list.reduce((sum, e) => sum + (e.recurring ? e.amount : 0), 0);
}

export function newExpense(): OperationalExpense {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `exp-${Date.now()}`,
    name: "",
    amount: 0,
    kind: "outro",
    recurring: true,
  };
}