import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchBIGoals, saveMonthlyGoals, DEFAULT_GOALS, type BIGoals } from "@/lib/bi/goals";
import { ArrowLeft, Save, Target, Radio, RotateCcw } from "lucide-react";
import {
  readChannelGoals,
  writeChannelGoals,
  SOURCE_LABEL,
  type ProspectSource,
} from "@/lib/bi/meios";

export const Route = createFileRoute("/metas-objetivos")({
  head: () => ({ meta: [{ title: "Metas e Objetivos — INFINDA" }] }),
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (goalsQ.data) setForm(goalsQ.data); }, [goalsQ.data]);

  const set = <K extends keyof BIGoals>(k: K) => (v: string) =>
    setForm((f) => ({ ...f, [k]: Number(v.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0 }));

  const restante = Math.max(0, form.revenue_goal - form.recurring_revenue_goal);

  const onSave = async () => {
    setSaving(true); setMsg(null);
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
      payroll: form.payroll_cost,
      infra: form.infra_cost,
      taxesPct: form.taxes_pct,
      weeklyRevenue: form.weekly_revenue_goal,
      dailyVisits: form.daily_visits_goal,
      dailyContacts: form.daily_contacts_goal,
      weeklyDispatches: form.weekly_dispatches_goal,
    });
    setSaving(false);
    if (r.ok) {
      setMsg("Metas salvas com sucesso.");
      qc.invalidateQueries({ queryKey: ["bi"] });
    } else {
      setMsg(`Erro: ${r.error ?? "falha ao salvar"}`);
    }
  };

  return (
    <AppShell title="Metas e Objetivos" subtitle="Configurações · Cockpit Executivo">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <Link to="/bi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao BI
          </Link>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" /> Meta do mês corrente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Meta total mensal (R$)" value={form.revenue_goal} onChange={set("revenue_goal")} />
              <Field label="Meta recorrente mensal (MRR garantido)" value={form.recurring_revenue_goal} onChange={set("recurring_revenue_goal")} />
              <Field label="Ticket médio esperado (R$)" value={form.ticket_goal} onChange={set("ticket_goal")} />
              <Field label="Meta de contratos novos" value={form.contracts_goal} onChange={set("contracts_goal")} integer />
              <Field label="Meta de reuniões" value={form.meetings_goal} onChange={set("meetings_goal")} integer />
              <Field label="Meta de leads" value={form.leads_goal} onChange={set("leads_goal")} integer />
            </div>

            <div className="rounded-lg border border-border bg-card/60 p-4 grid grid-cols-3 gap-3">
              <Mini label="Meta total" value={fmtBRL(form.revenue_goal)} tone="text-foreground" />
              <Mini label="Recorrência" value={fmtBRL(form.recurring_revenue_goal)} tone="text-emerald-400" />
              <Mini label="Novos contratos necessários" value={fmtBRL(restante)} tone="text-primary" />
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-medium text-foreground mb-2">Ritmo semanal e diário</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meta semanal de receita (R$)" value={form.weekly_revenue_goal} onChange={set("weekly_revenue_goal")} />
                <Field label="Meta semanal de disparos" value={form.weekly_dispatches_goal} onChange={set("weekly_dispatches_goal")} integer />
                <Field label="Meta diária de visitas" value={form.daily_visits_goal} onChange={set("daily_visits_goal")} integer />
                <Field label="Meta diária de contatos" value={form.daily_contacts_goal} onChange={set("daily_contacts_goal")} integer />
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-medium text-foreground mb-2">Custos operacionais (para Lucro real)</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Folha mensal (R$)" value={form.payroll_cost} onChange={set("payroll_cost")} />
                <Field label="Infraestrutura mensal (R$)" value={form.infra_cost} onChange={set("infra_cost")} />
                <Field label="Impostos sobre receita (%)" value={form.taxes_pct} onChange={set("taxes_pct")} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Lucro real = Receita − (Marketing + Folha + Infra + Impostos). O custo de marketing já vem dos lançamentos do BI.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando…" : "Salvar metas"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ChannelGoalsCard />

        <p className="text-[11px] text-muted-foreground">
          A recorrência é considerada como garantida automaticamente nos cálculos do Cockpit. O gap comercial e a página
          "Para bater a meta" passam a usar <strong>meta − recorrência − receita realizada</strong> em vez de meta total.
        </p>
      </div>
    </AppShell>
  );
}

const CHANNEL_ORDER: ProspectSource[] = [
  "visita",
  "whatsapp",
  "cadencia",
  "indicacao",
  "parceria",
  "conteudo",
  "remarketing",
  "trafego",
  "outros",
];

function ChannelGoalsCard() {
  const qc = useQueryClient();
  const [goals, setGoals] = useState<Record<ProspectSource, number>>(() => readChannelGoals());
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const total = CHANNEL_ORDER.reduce((sum, k) => sum + (goals[k] || 0), 0);

  const setOne = (k: ProspectSource, v: string) => {
    const n = Number(v.replace(/[^\d-]/g, "")) || 0;
    setGoals((g) => ({ ...g, [k]: Math.max(0, n) }));
  };

  const onSave = () => {
    writeChannelGoals(goals);
    setSavedAt(Date.now());
    qc.invalidateQueries({ queryKey: ["bi", "meios"] });
  };

  const onReset = () => {
    const empty = CHANNEL_ORDER.reduce(
      (acc, k) => ({ ...acc, [k]: 0 }),
      {} as Record<ProspectSource, number>,
    );
    setGoals(empty);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4 text-primary" /> Metas por canal · Meios de Prospecção
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          Total previsto: <span className="text-foreground tabular-nums">{total}</span> leads/mês
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CHANNEL_ORDER.map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{SOURCE_LABEL[k]}</Label>
              <Input
                inputMode="numeric"
                value={goals[k] ?? 0}
                onChange={(e) => setOne(k, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Define a meta mensal de leads por canal usada nas barras de progresso de "Meios de Prospecção".
            Armazenado localmente neste navegador.
          </p>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-[11px] text-emerald-400">Salvo ✓</span>
            )}
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Zerar
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="mr-1 h-3.5 w-3.5" /> Salvar canais
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, integer }: { label: string; value: number; onChange: (v: string) => void; integer?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        inputMode={integer ? "numeric" : "decimal"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}