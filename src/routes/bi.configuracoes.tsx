import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  DollarSign,
  Target,
  Megaphone,
  Wallet,
  RotateCcw,
} from "lucide-react";
import { fetchBIGoals, saveMonthlyGoals, DEFAULT_GOALS, type BIGoals } from "@/lib/bi/goals";
import {
  readExpenses,
  writeExpenses,
  totalExpenses,
  newExpense,
  DEFAULT_EXPENSES,
  type OperationalExpense,
  type ExpenseKind,
} from "@/lib/bi/expenses";

export const Route = createFileRoute("/bi/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações Operacionais — Business · INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Page() {
  const qc = useQueryClient();
  const goalsQ = useQuery<BIGoals>({
    queryKey: ["bi", "goals"],
    queryFn: fetchBIGoals,
    placeholderData: DEFAULT_GOALS,
  });

  const [form, setForm] = useState<BIGoals>(goalsQ.data ?? DEFAULT_GOALS);
  const [expenses, setExpenses] = useState<OperationalExpense[]>(() => readExpenses());
  const [savingGoals, setSavingGoals] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (goalsQ.data) setForm(goalsQ.data); }, [goalsQ.data]);

  const expensesTotal = useMemo(() => totalExpenses(expenses), [expenses]);

  const setNum = <K extends keyof BIGoals>(k: K) => (v: string) =>
    setForm((f) => ({ ...f, [k]: Math.max(0, Number(v.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0) }));

  const onSaveGoals = async () => {
    setSavingGoals(true);
    setMsg(null);
    const now = new Date();
    const r = await saveMonthlyGoals({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      revenue: form.revenue_goal,
      recurring: form.recurring_revenue_goal,
      contracts: form.contracts_goal,
      leads: form.leads_goal,
      meetings: form.meetings_goal,
      ticket: form.ticket_goal,
      payroll: expensesTotal || form.payroll_cost,
      infra: form.infra_cost,
      taxesPct: form.taxes_pct,
      weeklyRevenue: form.weekly_revenue_goal,
      dailyVisits: form.daily_visits_goal,
      dailyContacts: form.daily_contacts_goal,
      weeklyDispatches: form.weekly_dispatches_goal,
      weeklyContracts: form.weekly_contracts_goal,
      weeklyCompanies: form.weekly_companies_goal,
      weeklyVideos: form.weekly_videos_goal,
      weeklyPartnerships: form.weekly_partnerships_goal,
      weeklyNewContacts: form.weekly_new_contacts_goal,
    });
    setSavingGoals(false);
    if (r.ok) {
      setMsg("Configurações salvas.");
      qc.invalidateQueries({ queryKey: ["bi"] });
    } else {
      setMsg(`Erro: ${r.error ?? "falha ao salvar"}`);
    }
  };

  const saveExpenses = (next: OperationalExpense[]) => {
    setExpenses(next);
    writeExpenses(next);
  };

  const updateExp = (id: string, patch: Partial<OperationalExpense>) =>
    saveExpenses(expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const removeExp = (id: string) => saveExpenses(expenses.filter((e) => e.id !== id));
  const addExp = () => saveExpenses([...expenses, newExpense()]);

  const onRestoreDefaults = () => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Restaurar padrões INFINDA? Isso apaga edições locais de metas, despesas, canais e previsão neste navegador."
    );
    if (!ok) return;
    try {
      window.localStorage.removeItem("bi.goals.overrides.v1");
      window.localStorage.removeItem("bi.expenses.v1");
      window.localStorage.removeItem("bi.meios.metas.v1");
      window.localStorage.removeItem("bi.forecast.settings.v1");
    } catch (err) {
      console.error("[restoreDefaults] falha ao limpar localStorage", err);
    }
    setForm(DEFAULT_GOALS);
    saveExpenses([...DEFAULT_EXPENSES]);
    qc.invalidateQueries({ queryKey: ["bi"] });
    setMsg("Padrões INFINDA restaurados.");
  };

  return (
    <AppShell
      title="Configurações Operacionais"
      subtitle="Business · metas, custos e parâmetros editáveis"
    >
      <div className="mx-auto max-w-4xl space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/bi"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Business
          </Link>
          {msg && <span className="text-xs text-emerald-400">{msg}</span>}
        </div>

        {/* 1. Metas Financeiras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" /> Metas financeiras
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Receita mensal (R$)" value={form.revenue_goal} onChange={setNum("revenue_goal")} />
            <Field label="Receita semanal (R$)" value={form.weekly_revenue_goal} onChange={setNum("weekly_revenue_goal")} />
            <Field label="Recorrência mensal — MRR garantido (R$)" value={form.recurring_revenue_goal} onChange={setNum("recurring_revenue_goal")} />
            <Field label="Ticket médio esperado (R$)" value={form.ticket_goal} onChange={setNum("ticket_goal")} />
            <Field label="Impostos sobre receita (%)" value={form.taxes_pct} onChange={setNum("taxes_pct")} />
            <Field label="Infraestrutura mensal (R$)" value={form.infra_cost} onChange={setNum("infra_cost")} />
          </CardContent>
        </Card>

        {/* 2. Metas Comerciais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" /> Metas comerciais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Contratos mensais" value={form.contracts_goal} onChange={setNum("contracts_goal")} integer />
            <Field label="Contratos semanais" value={form.weekly_contracts_goal} onChange={setNum("weekly_contracts_goal")} integer />
            <Field label="Visitas presenciais por dia" value={form.daily_visits_goal} onChange={setNum("daily_visits_goal")} integer />
            <Field label="Empresas trabalhadas por semana" value={form.weekly_companies_goal} onChange={setNum("weekly_companies_goal")} integer />
            <Field label="Contatos novos por dia" value={form.daily_contacts_goal} onChange={setNum("daily_contacts_goal")} integer />
            <Field label="Disparos semanais" value={form.weekly_dispatches_goal} onChange={setNum("weekly_dispatches_goal")} integer />
            <Field label="Novos contatos por semana" value={form.weekly_new_contacts_goal} onChange={setNum("weekly_new_contacts_goal")} integer />
            <Field label="Reuniões mensais" value={form.meetings_goal} onChange={setNum("meetings_goal")} integer />
            <Field label="Leads mensais" value={form.leads_goal} onChange={setNum("leads_goal")} integer />
          </CardContent>
        </Card>

        {/* 3. Marketing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" /> Marketing
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Vídeos semanais" value={form.weekly_videos_goal} onChange={setNum("weekly_videos_goal")} integer />
            <Field label="Parcerias estratégicas / semana" value={form.weekly_partnerships_goal} onChange={setNum("weekly_partnerships_goal")} integer />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onSaveGoals} disabled={savingGoals}>
            <Save className="mr-2 h-4 w-4" /> {savingGoals ? "Salvando…" : "Salvar metas"}
          </Button>
        </div>

        {/* 4. Despesas operacionais */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" /> Despesas operacionais
            </CardTitle>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total recorrente</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{fmtBRL(expensesTotal)}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_120px_60px] gap-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Nome</span>
              <span>Valor</span>
              <span>Tipo</span>
              <span>Recorrente</span>
              <span></span>
            </div>

            <div className="space-y-2">
              {expenses.map((e) => (
                <ExpenseRow
                  key={e.id}
                  e={e}
                  onChange={(p) => updateExp(e.id, p)}
                  onRemove={() => removeExp(e.id)}
                />
              ))}
              {expenses.length === 0 && (
                <p className="rounded-md border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                  Nenhuma despesa cadastrada.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Despesas recorrentes alimentam o cálculo de <strong>Lucro real</strong> no Cockpit
                (sobrescreve "Folha mensal" ao salvar metas).
              </p>
              <Button variant="outline" size="sm" onClick={addExp}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar despesa
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          Todas as configurações são salvas localmente neste navegador enquanto a infraestrutura
          definitiva não é provisionada. Nenhuma métrica permanece hardcoded — qualquer valor pode
          ser editado aqui.
        </p>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  integer,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  integer?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        inputMode={integer ? "numeric" : "decimal"}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
      />
    </div>
  );
}

const KIND_LABEL: Record<ExpenseKind, string> = {
  pessoal: "Pessoal",
  infra: "Infra",
  veiculo: "Veículo",
  outro: "Outro",
};

function ExpenseRow({
  e,
  onChange,
  onRemove,
}: {
  e: OperationalExpense;
  onChange: (p: Partial<OperationalExpense>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-card/40 p-3 sm:grid-cols-[1.4fr_1fr_1fr_120px_60px] sm:items-center sm:gap-2 sm:p-2">
      <Input
        placeholder="Nome da despesa"
        value={e.name}
        maxLength={80}
        onChange={(ev) => onChange({ name: ev.target.value })}
      />
      <Input
        inputMode="decimal"
        placeholder="0"
        value={e.amount}
        onChange={(ev) =>
          onChange({
            amount: Math.max(0, Number(ev.target.value.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0),
          })
        }
      />
      <Select value={e.kind} onValueChange={(v) => onChange({ kind: v as ExpenseKind })}>
        <SelectTrigger>
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(KIND_LABEL) as ExpenseKind[]).map((k) => (
            <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Switch checked={e.recurring} onCheckedChange={(v) => onChange({ recurring: v })} />
        <span className="text-xs text-muted-foreground">{e.recurring ? "Mensal" : "Eventual"}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remover">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}