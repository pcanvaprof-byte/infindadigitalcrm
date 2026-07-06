import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FORECAST_SETTINGS_EVENT } from "@/lib/bi/forecast-settings";
import { FEATURES } from "@/config/features";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle, Target, DollarSign, Activity, Sparkles, Users, CalendarClock, FileText, FileSignature, Percent, Settings2, Network } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from "recharts";
import { fetchBIDashboard, fetchComercialFunnel, type BIArea, type BIDashboardPayload } from "@/lib/bi/api";
import { fetchBIGoals, DEFAULT_GOALS, type BIGoals } from "@/lib/bi/goals";
import { fetchDiretoriaKpis, type DiretoriaKpis } from "@/lib/bi/diretoria";
import { fetchForecastForPeriod, type ForecastBreakdown } from "@/lib/bi/forecast";
import { fetchBillingKpis, type BillingKpis } from "@/lib/bi/billing";
import { AIInsightsPanel } from "@/components/bi/AIInsightsPanel";
import { ExportMenu, type ExportSection } from "@/components/bi/ExportMenu";
import { EvolucaoMes } from "@/components/bi/EvolucaoMes";
import { KpiGoalCard } from "@/components/bi/KpiGoalCard";
import { ForecastCard } from "@/components/bi/ForecastCard";
import { FunilExecutivo } from "@/components/bi/FunilExecutivo";
import { FinanceiroPanel } from "@/components/bi/FinanceiroPanel";
import { MarketingPanel } from "@/components/bi/MarketingPanel";
import { OperacoesPanel } from "@/components/bi/OperacoesPanel";
import { HojePanel } from "@/components/bi/HojePanel";
import { SemanaPanel } from "@/components/bi/SemanaPanel";
import { CascataOperacional } from "@/components/bi/CascataOperacional";
import { GargalosPanel } from "@/components/bi/GargalosPanel";
import { PrevisaoPanel } from "@/components/bi/PrevisaoPanel";
import { PerformanceSemanaPanel } from "@/components/bi/PerformanceSemanaPanel";
import { readExpenses, expensesByKind, EXPENSES_EVENT, type OperationalExpense } from "@/lib/bi/expenses";
import { MeiosProspeccaoPanel } from "@/components/bi/MeiosProspeccaoPanel";
import {
  ComercialCharts, FinanceiroCharts, MarketingCharts, OperacoesCharts,
} from "@/components/bi/AreaCharts";
import { PeriodSelector } from "@/components/bi/PeriodSelector";
import { DrillDownProvider, useDrillDown } from "@/hooks/useDrillDown";
import {
  periodSearchSchema,
  resolvePeriod,
  scaleGoal,
  scaleWeeklyGoal,
  goalScopeLabel,
  type ResolvedPeriod,
  type PeriodKey,
} from "@/lib/bi/period";
import type { ReactNode } from "react";
import type { DrillKind } from "@/lib/bi/drilldown";
import type { CascataStepId } from "@/components/bi/CascataOperacional";

/** Wrapper que injeta o handler de drill-down em qualquer card KPI. */
function DrillKpi(
  props: React.ComponentProps<typeof KpiGoalCard> & {
    drill?: { kind: DrillKind; title: string; crumb?: string; params?: Record<string, unknown> };
  },
) {
  const { drill, ...rest } = props;
  const dd = useDrillDown();
  return (
    <KpiGoalCard
      {...rest}
      onDrillDown={
        drill
          ? () =>
              dd.open({
                id: `${drill.kind}-${drill.title}`,
                kind: drill.kind,
                title: drill.title,
                crumb: drill.crumb,
                params: drill.params,
              })
          : undefined
      }
    />
  );
}

/** Wrap painel "Hoje/Semana" com badge de escopo. */
function ScopeWrapper({
  active,
  scopeLabel,
  children,
}: {
  active: boolean;
  scopeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <div
        className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
          active
            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
            : "border-border bg-card/80 text-muted-foreground"
        }`}
        title={active ? "Contexto ativo" : "Sempre visível — fora do período filtrado"}
      >
        {scopeLabel}
      </div>
      <div className={active ? "" : "opacity-70"}>{children}</div>
    </div>
  );
}

const STEP_TO_DRILL: Record<CascataStepId, { kind: DrillKind; title: string; crumb: string }> = {
  meta:      { kind: "contracts",     title: "Contratos do período",  crumb: "Diretoria · Meta" },
  contratos: { kind: "contracts",     title: "Contratos do período",  crumb: "Diretoria · Contratos" },
  reunioes:  { kind: "touchpoints-channel", title: "Reuniões registradas", crumb: "Diretoria · Reuniões" },
  contatos:  { kind: "touchpoints",   title: "Touchpoints do período", crumb: "Diretoria · Contatos" },
  empresas:  { kind: "empresas",      title: "Empresas trabalhadas",   crumb: "Diretoria · Empresas" },
  disparos:  { kind: "dispatches",    title: "Disparos de cadência",   crumb: "Diretoria · Disparos" },
};

function CascataCard(props: React.ComponentProps<typeof CascataOperacional>) {
  const dd = useDrillDown();
  return (
    <CascataOperacional
      {...props}
      onDrillDown={(step) => {
        const t = STEP_TO_DRILL[step];
        dd.open({ id: `cascata-${step}`, kind: t.kind, title: t.title, crumb: t.crumb });
      }}
    />
  );
}

type GargaloItem = React.ComponentProps<typeof GargalosPanel>["items"][number] & {
  drill?: { kind: DrillKind; title: string; crumb?: string; params?: Record<string, unknown> };
};
function GargalosCard({ items }: { items: GargaloItem[] }) {
  const dd = useDrillDown();
  return (
    <GargalosPanel
      items={items.map((it) => ({
        ...it,
        onDrillDown: it.drill
          ? () =>
              dd.open({
                id: `gargalo-${it.label}`,
                kind: it.drill!.kind,
                title: it.drill!.title,
                crumb: it.drill!.crumb,
                params: it.drill!.params,
              })
          : undefined,
      }))}
    />
  );
}

function FunilCard(props: React.ComponentProps<typeof FunilExecutivo>) {
  const dd = useDrillDown();
  return (
    <FunilExecutivo
      {...props}
      onStageClick={(s) =>
        dd.open({
          id: `funil-${s.stage}`,
          kind: "leads-stage",
          title: `Etapa: ${s.stage}`,
          crumb: `Comercial · ${s.stage}`,
          params: { stage: s.stage },
        })
      }
    />
  );
}

export const Route = createFileRoute("/bi")({
  component: BIPageGate,
  validateSearch: periodSearchSchema,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro BI: {String(error)}</div>
  ),
  notFoundComponent: () => <div className="p-6">Página não encontrada</div>,
});

function BIPageGate() {
  const matches = useMatches();
  const isChild = matches.some((m) => m.routeId !== "__root__" && m.routeId !== "/bi" && m.routeId.startsWith("/bi/"));
  if (isChild) return <Outlet />;
  if (!FEATURES.businessIntelligence) {
    return (
      <AppShell title="Business Intelligence" subtitle="Centro executivo">
        <div className="p-6 text-sm text-muted-foreground">
          <strong>Business Intelligence está desativado.</strong>
          <p className="mt-2">
            Reative em <code>src/config/features.ts</code> (<code>FEATURES.businessIntelligence = true</code>).
          </p>
        </div>
      </AppShell>
    );
  }
  return <BIPage />;
}

const AREAS: Array<{ id: BIArea; label: string; icon: typeof TrendingUp }> = [
  { id: "diretoria",  label: "Diretoria",  icon: Target },
  { id: "comercial",  label: "Comercial",  icon: TrendingUp },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "marketing",  label: "Marketing",  icon: Activity },
  { id: "operacoes",  label: "Operações",  icon: AlertTriangle },
  { id: "meios",      label: "Meios de Prospecção", icon: Network },
];

const fmtBRL = (n: number | null | undefined) =>
  (Number.isFinite(n as number) ? (n as number) : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const fmtNum = (n: number | null | undefined) =>
  Number.isFinite(n as number) ? String(n) : "0";

const fmtPct = (n: number | null | undefined) =>
  `${Number.isFinite(n as number) ? (n as number) : 0}%`;

function diasNoMes(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function diaAtual(d = new Date()) {
  return d.getDate();
}
function diasUteisNoMes(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth();
  const total = new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let i = 1; i <= total; i++) {
    const dow = new Date(y, m, i).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}
function diasUteisAteHoje(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth(), dia = d.getDate();
  let n = 0;
  for (let i = 1; i <= dia; i++) {
    const dow = new Date(y, m, i).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return Math.max(1, n);
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MetaHero({
  realizado, ticket, meta, recorrencia, period,
}: { realizado: number; ticket: number; meta: number; recorrencia: number; period?: ResolvedPeriod }) {
  const total = diasUteisNoMes();
  const dia = diasUteisAteHoje();
  const totalCal = diasNoMes();
  const diaCal = diaAtual();
  const scopeLabel = period ? goalScopeLabel(period) : "do mês";
  // Realizado total = recorrência garantida + novos negócios já fechados no mês.
  const novos = Math.max(0, realizado);
  const realizadoTotal = recorrencia + novos;
  const ritmoNovos = dia > 0 ? novos / dia : 0;
  const projetadoNovos = Math.round(ritmoNovos * total);
  const projetadoTotal = recorrencia + projetadoNovos;
  const gap = Math.max(0, meta - projetadoTotal);
  const pctReal = meta > 0 ? Math.min(100, Math.round((realizadoTotal / meta) * 100)) : 0;
  const pctIdeal = total > 0 ? Math.round((dia / total) * 100) : 0;
  const prob = meta > 0 ? Math.max(0, Math.min(100, Math.round((projetadoTotal / meta) * 100))) : 0;
  const status = prob >= 100 ? "no ritmo" : prob >= 85 ? "atenção" : "crítico";
  const statusTone =
    status === "no ritmo" ? "text-emerald-400" : status === "atenção" ? "text-amber-400" : "text-rose-400";
  const idealAcum = total > 0 ? Math.round((meta * dia) / total) : 0;
  const diffIdeal = realizadoTotal - idealAcum;
  const faltam = Math.max(0, meta - realizadoTotal);
  const contratosFaltam = ticket > 0 ? Math.max(0, Math.ceil(faltam / ticket)) : 0;

  const pctRecorrencia = meta > 0 ? Math.round((recorrencia / meta) * 100) : 0;
  const pctNovos = meta > 0 ? Math.round((novos / meta) * 100) : 0;
  const pctFaltam = Math.max(0, 100 - pctRecorrencia - pctNovos);

  return (
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
      <CardContent className="p-6 grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
            <Target className="h-3.5 w-3.5" /> Meta total {scopeLabel}
          </div>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-semibold">{fmtBRL(realizadoTotal)}</span>
            <span className="text-sm text-muted-foreground">de {fmtBRL(meta)}</span>
            <Badge variant="secondary" className={statusTone}>{pctReal}% atingido</Badge>
          </div>
          {/* Barra empilhada: recorrência (garantida) + novos (conquistado) + gap */}
          <div className="mt-4 h-2.5 w-full rounded-full bg-muted/40 overflow-hidden flex">
            <div className="h-full bg-emerald-500/80" style={{ width: `${pctRecorrencia}%` }} title={`Recorrência ${fmtBRL(recorrencia)}`} />
            <div className="h-full bg-primary" style={{ width: `${pctNovos}%` }} title={`Novos ${fmtBRL(novos)}`} />
            <div className="h-full bg-muted/30" style={{ width: `${pctFaltam}%` }} title={`Faltam ${fmtBRL(faltam)}`} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-emerald-500/80" /> Recorrência {pctRecorrencia}%</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-primary" /> Novos {pctNovos}%</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-muted/60" /> Faltam {pctFaltam}%</span>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>Dia útil {dia}/{total} · calend. {diaCal}/{totalCal}</span>
            <span>Ideal acumulado: {pctIdeal}%</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Projeção final: <strong className="text-foreground">{fmtBRL(projetadoTotal)}</strong> ·
            Probabilidade de bater: <strong className={statusTone}>{prob}%</strong>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 content-start">
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recorrência garantida</p>
            <p className="mt-1 text-xl font-semibold text-emerald-400">{fmtBRL(recorrencia)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Novos negócios (mês)</p>
            <p className="mt-1 text-xl font-semibold text-primary">{fmtBRL(novos)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faltam (gap comercial)</p>
            <p className="mt-1 text-xl font-semibold text-rose-400">{fmtBRL(faltam)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Δ vs ideal · faltam</p>
            <p className={`mt-1 text-xl font-semibold ${diffIdeal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {diffIdeal >= 0 ? "+" : ""}{fmtBRL(diffIdeal)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">≈ {contratosFaltam} contratos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BIPage() {
  const [area, setArea] = useState<BIArea>("diretoria");
  const search = useSearch({ from: "/bi" });
  const period = useMemo<ResolvedPeriod>(
    () => resolvePeriod((search.period ?? "mes") as PeriodKey, search.from, search.to),
    [search.period, search.from, search.to],
  );
  const areaLabel = AREAS.find((a) => a.id === area)?.label ?? "BI";

  const dashQuery = useQuery<BIDashboardPayload>({
    queryKey: ["bi", "dashboard", area, period.key, period.from.toISOString(), period.to.toISOString()],
    queryFn: async () => {
      const base = await fetchBIDashboard(area);
      if (area === "comercial" || area === "diretoria") {
        const funnel = await fetchComercialFunnel(period);
        return { ...base, funnel };
      }
      return base;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Fallback client-side para Diretoria — garante a tela mesmo se a RPC falhar.
  const diretoriaFallback = useQuery<DiretoriaKpis>({
    queryKey: ["bi", "diretoria-fallback"],
    queryFn: fetchDiretoriaKpis,
    // Mantemos o fallback ligado para todas as abas — Financeiro/Marketing/Operações
    // dependem dele quando a RPC `bi_dashboard` devolve vazio (caso contrário
    // os três painéis ficam idênticos, mostrando só os Insights).
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const goalsQuery = useQuery<BIGoals>({
    queryKey: ["bi", "goals"],
    queryFn: fetchBIGoals,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: DEFAULT_GOALS,
  });

  // Despesas operacionais — fonte real do lucro
  const expensesQuery = useQuery<OperationalExpense[]>({
    queryKey: ["bi", "expenses"],
    queryFn: async () => readExpenses(),
    staleTime: Infinity,
  });
  useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ["bi", "expenses"] });
    window.addEventListener(EXPENSES_EVENT, handler);
    return () => window.removeEventListener(EXPENSES_EVENT, handler);
    // queryClient declarado adiante; capturamos via closure abaixo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Previsão por período — recalcula quando muda Hoje/Semana/Mês/Trimestre.
  const previsaoQuery = useQuery<ForecastBreakdown>({
    queryKey: ["bi", "previsao", period.key, period.from.toISOString(), period.to.toISOString()],
    queryFn: () => fetchForecastForPeriod(period),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // Quando o usuário muda fallback/janela/mínimo de amostra, invalidamos a previsão
  // para que a probabilidade reflita imediatamente a nova configuração.
  const queryClient = useQueryClient();
  useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ["bi", "previsao"] });
    window.addEventListener(FORECAST_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(FORECAST_SETTINGS_EVENT, handler);
  }, [queryClient]);

  const data = dashQuery.data ?? null;
  const loading = dashQuery.isLoading || dashQuery.isFetching;
  const errRaw = dashQuery.error;
  const err = errRaw
    ? (errRaw instanceof Error
        ? errRaw.message
        : typeof errRaw === "object" && errRaw !== null
          ? ((errRaw as { message?: string }).message ?? JSON.stringify(errRaw))
          : String(errRaw))
    : null;
  const goals = goalsQuery.data ?? DEFAULT_GOALS;
  const expenses = expensesQuery.data ?? [];
  const expBreak = expensesByKind(expenses);
  const hasExpenses = expBreak.count > 0;
  const folhaCalc = hasExpenses ? expBreak.pessoal : (goals.payroll_cost || 0);
  const infraCalc = hasExpenses ? expBreak.infra : (goals.infra_cost || 0);
  const veiculosCalc = expBreak.veiculo;
  const outrosCalc = expBreak.outro;

  // Merge: se a RPC não trouxe kpis, usa o fallback client-side (Diretoria).
  const fb = diretoriaFallback.data;
  const diretoriaKpis = (data?.kpis ?? (fb ? {
    clientes_ativos: fb.clientes_ativos,
    ticket_medio: fb.ticket_medio,
    mrr: fb.mrr,
    arr: fb.arr,
    receita_realizada: fb.receita_realizada,
    receita_prevista_mes: fb.mrr,
    custo_marketing: 0,
    cac: 0,
    ltv: 0,
    roi: 0,
    payback_meses: 0,
  } : null));

  const exportSections = useMemo<ExportSection[]>(() => {
    if (!data) return [];
    const out: ExportSection[] = [];
    if (data.kpis) out.push({ title: "KPIs", rows: [data.kpis as unknown as Record<string, unknown>] });
    if (data.forecast) out.push({ title: "Previsão", rows: [data.forecast as unknown as Record<string, unknown>] });
    if (data.funnel) out.push({ title: "Funil", rows: data.funnel as unknown as Array<Record<string, unknown>> });
    if (data.lost?.recentes) out.push({ title: "Perdidos recentes", rows: data.lost.recentes });
    if (data.churn?.detalhes) out.push({ title: "Risco de churn", rows: data.churn.detalhes as unknown as Array<Record<string, unknown>> });
    if (data.best_hours) out.push({ title: "Melhores horarios", rows: data.best_hours as unknown as Array<Record<string, unknown>> });
    if (data.best_channels) out.push({ title: "Canais", rows: data.best_channels as unknown as Array<Record<string, unknown>> });
    if (data.top_campaigns) out.push({ title: "Top campanhas", rows: data.top_campaigns as unknown as Array<Record<string, unknown>> });
    return out;
  }, [data]);

  return (
    <DrillDownProvider period={period} areaLabel={areaLabel}>
    <AppShell
      title="Business Intelligence"
      subtitle="Cockpit executivo · metas, previsão e ações"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PeriodSelector period={period} />
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {loading ? "Atualizando..." : "Pronto"}
          </Badge>
          <Link
            to="/metas-objetivos"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50"
            title="Configurar metas e objetivos"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Metas</span>
          </Link>
          <Link
            to="/bi/configuracoes"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50"
            title="Configurações operacionais"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Configurações</span>
          </Link>
          <ExportMenu filename={`bi-${area}`} sections={exportSections} />
        </div>
      }
    >
    <div className="space-y-5">

      <Tabs value={area} onValueChange={(v) => setArea(v as BIArea)}>
        <nav
          aria-label="Áreas de BI"
          className="flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card/60 p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {AREAS.map((a) => {
            const Icon = a.icon;
            const active = area === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setArea(a.id)}
                className={`group inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all ${
                  active
                    ? "border-primary/50 bg-primary/15 text-foreground shadow-sm"
                    : "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                <span>{a.label}</span>
              </button>
            );
          })}
        </nav>

        {AREAS.map((a) => (
          <TabsContent key={a.id} value={a.id} className="mt-4 space-y-5">
            {err && a.id !== "diretoria" && (
              <p className="text-sm text-destructive">{err}</p>
            )}
            {err && a.id === "diretoria" && (
              <p className="text-xs text-muted-foreground">
                BI server indisponível — exibindo dados calculados localmente.
              </p>
            )}
            {loading && !data && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            )}

            {a.id === "diretoria" && diretoriaKpis && (
              <>
                <MetaHero
                  realizado={diretoriaKpis.receita_realizada ?? 0}
                  ticket={diretoriaKpis.ticket_medio ?? 0}
                  meta={scaleGoal(goals.revenue_goal, period)}
                  recorrencia={scaleGoal(diretoriaKpis.mrr ?? 0, period)}
                  period={period}
                />
                <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                  <ScopeWrapper active={period.key === "hoje"} scopeLabel="Hoje">
                    <HojePanel
                      visitsGoal={goals.daily_visits_goal}
                      contactsGoal={goals.daily_contacts_goal}
                      dispatchesGoal={Math.max(1, Math.round(goals.weekly_dispatches_goal / 5))}
                    />
                  </ScopeWrapper>
                  <ScopeWrapper active={period.key === "semana"} scopeLabel="Semana">
                    <SemanaPanel metaSemanal={goals.weekly_revenue_goal} />
                  </ScopeWrapper>
                </div>
                <PerformanceSemanaPanel
                  period={period}
                  goals={{
                    receita: goals.weekly_revenue_goal,
                    contratos: goals.weekly_contracts_goal,
                    empresas: goals.weekly_companies_goal,
                    disparos: goals.weekly_dispatches_goal,
                    novosContatos: goals.weekly_new_contacts_goal,
                    videos: goals.weekly_videos_goal,
                    parcerias: goals.weekly_partnerships_goal,
                  }}
                />
                <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                  <CascataCard
                    meta={scaleGoal(goals.revenue_goal, period)}
                    realizado={diretoriaKpis.receita_realizada ?? 0}
                    recorrencia={scaleGoal(diretoriaKpis.mrr ?? 0, period)}
                    ticket={diretoriaKpis.ticket_medio ?? 0}
                    taxaConversao={data?.forecast?.taxa_conversao_historica ?? null}
                  />
                  <GargalosCard
                    items={[
                      { label: `Receita ${goalScopeLabel(period)}`, scope: period.label,
                        value: Math.round(
                          scaleGoal(
                            diretoriaKpis.mrr ?? 0,
                            period,
                          ) + (diretoriaKpis.receita_realizada ?? 0),
                        ),
                        goal: scaleGoal(goals.revenue_goal, period),
                        drill: { kind: "contracts" as const, title: "Contratos do período", crumb: "Diretoria · Receita" } },
                      { label: "Receita da semana", scope: "semana",
                        value: Math.round(diretoriaKpis.receita_realizada ?? 0),
                        goal: goals.weekly_revenue_goal,
                        drill: { kind: "contracts" as const, title: "Contratos do período", crumb: "Diretoria · Receita" } },
                      { label: "Contratos", scope: period.label,
                        value: (data?.funnel ?? []).find((s) => /contrat|fech/i.test(s.stage))?.clientes ?? 0,
                        goal: scaleGoal(goals.contracts_goal, period),
                        drill: { kind: "contracts" as const, title: "Contratos do período", crumb: "Diretoria · Contratos" } },
                      { label: "Reuniões", scope: period.label,
                        value: (data?.funnel ?? []).find((s) => /reuni/i.test(s.stage))?.clientes ?? 0,
                        goal: scaleGoal(goals.meetings_goal, period),
                        drill: { kind: "touchpoints-channel" as const, title: "Reuniões registradas", crumb: "Diretoria · Reuniões" } },
                      { label: "Leads", scope: period.label,
                        value: (data?.funnel ?? []).find((s) => /lead|prospec/i.test(s.stage))?.clientes
                          ?? (data?.funnel?.[0]?.clientes ?? 0),
                        goal: scaleGoal(goals.leads_goal, period),
                        drill: { kind: "prospects-new" as const, title: "Leads novos do período", crumb: "Diretoria · Leads" } },
                    ]}
                  />
                </div>
                <PrevisaoPanel
                  recorrencia={
                    previsaoQuery.data?.recorrencia
                    ?? Math.round(
                      (diretoriaKpis.mrr ?? 0) * (period.days / 30),
                    )
                  }
                  fechado={
                    previsaoQuery.data?.fechado
                    ?? (period.key === "mes" ? (diretoriaKpis.receita_realizada ?? 0) : 0)
                  }
                  pipelineAberto={
                    previsaoQuery.data?.pipelineAberto ?? (data?.forecast?.pipeline_aberto ?? 0)
                  }
                  pipelineProbabilidade={
                    previsaoQuery.data?.pipelineProbabilidade
                    ?? (data?.forecast?.taxa_conversao_historica
                      ? Math.min(1, data.forecast.taxa_conversao_historica / 100)
                      : undefined)
                  }
                  probabilidadeSource={previsaoQuery.data?.probabilidadeSource}
                  probabilidadeMotivo={previsaoQuery.data?.probabilidadeMotivo}
                  amostra={previsaoQuery.data?.amostra}
                  meta={scaleGoal(goals.revenue_goal, period)}
                  periodLabel={period.label}
                  rangeLabel={period.rangeLabel}
                />
                <EvolucaoMes
                  period={period}
                  meta={scaleGoal(goals.revenue_goal, period)}
                  realizado={diretoriaKpis.receita_realizada ?? 0}
                />
              </>
            )}

            {a.id === "comercial" && (() => {
              const stages = data?.funnel ?? [];
              const findStage = (re: RegExp) =>
                stages.find((s) => re.test((s.stage ?? "").toLowerCase()))?.clientes ?? 0;
              const leads = findStage(/lead|prospec/) || (stages[0]?.clientes ?? 0);
              const reunioes = findStage(/reuni/);
              const propostas = findStage(/propos/);
              const contratos = findStage(/contrat|fech/) || (stages[stages.length - 1]?.clientes ?? 0);
              const conversao = leads > 0 ? Math.round((contratos / leads) * 1000) / 10 : 0;

              const total = diasUteisNoMes();
              const dia = diasUteisAteHoje();
              const projetadoContratos = Math.round((contratos / dia) * total);

              return (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <DrillKpi label="Leads"     value={leads}    goal={scaleGoal(goals.leads_goal, period)}     icon={Users}
                      drill={{ kind: "prospects-new", title: "Leads novos do período", crumb: "Comercial · Leads" }} />
                    <DrillKpi label="Reuniões"  value={reunioes} goal={scaleGoal(goals.meetings_goal, period)}  icon={CalendarClock}
                      drill={{ kind: "touchpoints-channel", title: "Reuniões registradas", crumb: "Comercial · Reuniões" }} />
                    <DrillKpi label="Propostas" value={propostas} goal={scaleGoal(goals.proposals_goal, period)} icon={FileText}
                      drill={{ kind: "proposals", title: "Propostas do período", crumb: "Comercial · Propostas" }} />
                    <DrillKpi label="Contratos" value={contratos} goal={scaleGoal(goals.contracts_goal, period)} icon={FileSignature}
                      drill={{ kind: "contracts", title: "Contratos do período", crumb: "Comercial · Contratos" }} />
                    <DrillKpi
                      label="Conversão"
                      value={conversao}
                      goal={15}
                      icon={Percent}
                      format={(n) => `${n}%`}
                      drill={{ kind: "contracts", title: "Contratos do período", crumb: "Comercial · Conversão" }}
                    />
                  </div>

                  <ForecastCard
                    meta={scaleGoal(goals.contracts_goal, period)}
                    projecao={projetadoContratos}
                    unidade="contratos"
                  />

                  {stages.length > 0 && <FunilCard stages={stages} />}
                  <MeiosProspeccaoPanel period={period} />
                  <ComercialCharts period={period} />
                </div>
              );
            })()}

            {a.id === "financeiro" && (diretoriaKpis || data?.kpis) && (
              <FinanceiroPanel
                mrr={data?.kpis?.mrr ?? diretoriaKpis?.mrr ?? 0}
                arr={data?.kpis?.arr ?? diretoriaKpis?.arr ?? 0}
                receitaRealizada={data?.kpis?.receita_realizada ?? diretoriaKpis?.receita_realizada ?? 0}
                receitaPrevistaMes={data?.kpis?.receita_prevista_mes ?? diretoriaKpis?.mrr ?? 0}
                custoMarketing={data?.kpis?.custo_marketing ?? 0}
                ticketMedio={data?.kpis?.ticket_medio ?? diretoriaKpis?.ticket_medio ?? 0}
                pipelineAberto={data?.forecast?.pipeline_aberto ?? 0}
                previsao30d={data?.forecast?.previsao_30d ?? 0}
                previsao90d={data?.forecast?.previsao_90d ?? 0}
                folha={folhaCalc}
                infra={infraCalc}
                veiculos={veiculosCalc}
                outros={outrosCalc}
                taxasPct={goals.taxes_pct}
                expensesSource={hasExpenses ? "expenses" : "goals"}
              />
            )}
            {a.id === "financeiro" && <FinanceiroCharts period={period} />}

            {a.id === "marketing" && (diretoriaKpis || data?.kpis) && (
              <MarketingPanel
                custoMarketing={data?.kpis?.custo_marketing ?? 0}
                receitaRealizada={data?.kpis?.receita_realizada ?? diretoriaKpis?.receita_realizada ?? 0}
                cac={data?.kpis?.cac ?? 0}
                ltv={data?.kpis?.ltv ?? 0}
                roi={data?.kpis?.roi ?? 0}
                paybackMeses={data?.kpis?.payback_meses ?? 0}
                clientesAtivos={data?.kpis?.clientes_ativos ?? diretoriaKpis?.clientes_ativos ?? 0}
                ticketMedio={data?.kpis?.ticket_medio ?? diretoriaKpis?.ticket_medio ?? 0}
              />
            )}
            {a.id === "marketing" && <MarketingCharts period={period} />}

            {a.id === "operacoes" && (diretoriaKpis || data?.kpis) && (
              <OperacoesPanel
                funnel={data?.funnel ?? []}
                churn={data?.churn}
                clientesAtivos={data?.kpis?.clientes_ativos ?? diretoriaKpis?.clientes_ativos ?? 0}
                receitaRealizada={data?.kpis?.receita_realizada ?? diretoriaKpis?.receita_realizada ?? 0}
                receitaPrevistaMes={data?.kpis?.receita_prevista_mes ?? diretoriaKpis?.mrr ?? 0}
                taxaConversaoHistorica={data?.forecast?.taxa_conversao_historica ?? null}
              />
            )}
            {a.id === "operacoes" && <OperacoesCharts period={period} />}

            {a.id === "operacoes" && data?.funnel && data.funnel.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Gargalos do funil</CardTitle></CardHeader>
                <CardContent style={{ height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.funnel}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="clientes" name="Clientes" fill="hsl(var(--primary))" />
                      <Bar yAxisId="right" dataKey="tempo_medio_dias" name="Tempo médio (dias)" fill="hsl(var(--muted-foreground))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {a.id === "operacoes" && data?.churn && (
              <Card>
                <CardHeader><CardTitle className="text-base">Risco de churn</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <Kpi label="Alto" value={fmtNum(data.churn.alto)} />
                    <Kpi label="Médio" value={fmtNum(data.churn.medio)} />
                    <Kpi label="Baixo" value={fmtNum(data.churn.baixo)} />
                  </div>
                  {(data.churn.detalhes?.length ?? 0) > 0 && (
                    <div className="text-sm divide-y rounded-md border">
                      <div className="grid grid-cols-12 px-3 py-2 font-medium bg-muted/30">
                        <span className="col-span-5">Empresa</span>
                        <span className="col-span-3">Valor</span>
                        <span className="col-span-2">Dias inativo</span>
                        <span className="col-span-2">Risco</span>
                      </div>
                      {(data.churn.detalhes ?? []).slice(0, 10).map((d) => (
                        <div key={d.id} className="grid grid-cols-12 px-3 py-2">
                          <span className="col-span-5 truncate">{d.empresa}</span>
                          <span className="col-span-3">{fmtBRL(d.valor)}</span>
                          <span className="col-span-2">{d.dias_sem_update}</span>
                          <span className="col-span-2">
                            <Badge variant={d.risco === "alto" ? "destructive" : "secondary"}>
                              {d.risco}
                            </Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {a.id === "marketing" && data?.best_hours && data.best_hours.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Melhores horários de contato</CardTitle></CardHeader>
                <CardContent style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={data.best_hours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hora" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="enviados" stroke="hsl(var(--muted-foreground))" />
                      <Line type="monotone" dataKey="respondidos" stroke="hsl(var(--primary))" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {a.id === "marketing" && data?.best_channels && data.best_channels.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Melhores canais</CardTitle></CardHeader>
                <CardContent style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.best_channels}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="canal" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="enviados" fill="hsl(var(--muted-foreground))" />
                      <Bar dataKey="respondidos" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {a.id === "marketing" && data?.top_campaigns && data.top_campaigns.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Campanhas com maior conversão</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-sm divide-y rounded-md border">
                    <div className="grid grid-cols-12 px-3 py-2 font-medium bg-muted/30">
                      <span className="col-span-6">Campanha</span>
                      <span className="col-span-2">Status</span>
                      <span className="col-span-2">Clientes</span>
                      <span className="col-span-2">Receita</span>
                    </div>
                    {data.top_campaigns.map((c, i) => (
                      <div key={i} className="grid grid-cols-12 px-3 py-2">
                        <span className="col-span-6 truncate">{c.campanha}</span>
                        <span className="col-span-2">{c.status}</span>
                        <span className="col-span-2">{c.clientes}</span>
                        <span className="col-span-2">{fmtBRL(c.receita)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {a.id === "comercial" && data?.lost && (
              <Card>
                <CardHeader><CardTitle className="text-base">Oportunidades perdidas</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Kpi label="Total perdidos" value={fmtNum(data.lost.total)} />
                  <Kpi label="Valor perdido" value={fmtBRL(data.lost.valor_perdido)} />
                </CardContent>
              </Card>
            )}

            {a.id === "meios" && <MeiosProspeccaoPanel period={period} />}

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Insights executivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AIInsightsPanel area={a.id} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
    </AppShell>
    </DrillDownProvider>
  );
}