import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { crmKeys, listDeals, listClients, listDealStages } from "@/lib/crm/api";
import { loadAllProspects } from "@/lib/prospects-api";
import { loadMapPoints } from "@/lib/tasks-map-api";
import { listBriefings } from "@/lib/briefings/api";
import { deriveDashboardMetrics } from "@/lib/dashboard/api";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, useRequiredUser } from "@/lib/auth-context";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Award,
  Building2,
  CalendarClock,
  CheckCircle2,
  Crown,
  FileText,
  Flame,
  MessageSquare,
  Medal,
  Phone,
  Star,
  Target,
  Trophy,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/metas")({
  head: () => ({ meta: [{ title: "Metas — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <MetasPage />
    </RequireAuth>
  ),
});

type Metric = {
  key: string;
  label: string;
  icon: typeof Building2;
  current: number;
  daily: number;
  weekly: number;
};

const TEAM_METRICS: Metric[] = [
  { key: "empresas", label: "Empresas visitadas", icon: Building2, current: 112, daily: 25, weekly: 150 },
  { key: "conversas", label: "Conversas qualificadas", icon: MessageSquare, current: 41, daily: 10, weekly: 60 },
  { key: "apresentacoes", label: "Apresentações", icon: Phone, current: 22, daily: 5, weekly: 30 },
  { key: "reunioes", label: "Reuniões", icon: CalendarClock, current: 9, daily: 2, weekly: 12 },
  { key: "propostas", label: "Propostas", icon: FileText, current: 4, daily: 1, weekly: 6 },
  { key: "contratos", label: "Contratos fechados", icon: CheckCircle2, current: 3, daily: 1, weekly: 5 },
];

const MY_METRICS: Metric[] = [
  { key: "empresas", label: "Empresas visitadas", icon: Building2, current: 28, daily: 25, weekly: 150 },
  { key: "conversas", label: "Conversas qualificadas", icon: MessageSquare, current: 12, daily: 10, weekly: 60 },
  { key: "apresentacoes", label: "Apresentações", icon: Phone, current: 6, daily: 5, weekly: 30 },
  { key: "reunioes", label: "Reuniões", icon: CalendarClock, current: 3, daily: 2, weekly: 12 },
  { key: "propostas", label: "Propostas", icon: FileText, current: 2, daily: 1, weekly: 6 },
  { key: "contratos", label: "Contratos fechados", icon: CheckCircle2, current: 1, daily: 1, weekly: 5 },
];

const EMPTY_DAILY = [
  { d: "Seg", empresas: 0, conversas: 0, propostas: 0 },
  { d: "Ter", empresas: 0, conversas: 0, propostas: 0 },
  { d: "Qua", empresas: 0, conversas: 0, propostas: 0 },
  { d: "Qui", empresas: 0, conversas: 0, propostas: 0 },
  { d: "Sex", empresas: 0, conversas: 0, propostas: 0 },
];

const EMPTY_WEEKLY = [
  { s: "S1", atingido: 0 },
  { s: "S2", atingido: 0 },
  { s: "S3", atingido: 0 },
  { s: "S4", atingido: 0 },
  { s: "S5", atingido: 0 },
  { s: "S6", atingido: 0 },
];

const FUNNEL_FALLBACK: { label: string; value: number }[] = [];

type Ranked = {
  id: string;
  name: string;
  points: number;
  contracts: number;
  proposals: number;
  meetings: number;
  streak: number;
};

const RANKING_SDR: Ranked[] = [];
const RANKING_CONSULTORES: Ranked[] = [];

type Badge = { id: string; icon: typeof Trophy; label: string; desc: string; got: boolean; color: string };
function buildBadges(k: { prospectsTotal: number; prospectsContacted: number; meetings: number; proposals: number; dealsWon: number }, score: number): Badge[] {
  return [
    { id: "100", icon: Trophy, label: "100 empresas", desc: "100 empresas na base", got: k.prospectsTotal >= 100, color: "text-amber-300" },
    { id: "streak", icon: Flame, label: "Em chamas", desc: "7 dias batendo meta diária", got: false, color: "text-rose-300" },
    { id: "closer", icon: Crown, label: "Closer", desc: "5 contratos fechados", got: k.dealsWon >= 5, color: "text-violet-300" },
    { id: "speed", icon: TrendingUp, label: "Foguete", desc: "+30% sobre a meta semanal", got: score >= 30, color: "text-sky-300" },
    { id: "talker", icon: MessageSquare, label: "Negociador", desc: "60 conversas qualificadas", got: k.prospectsContacted >= 60, color: "text-emerald-300" },
    { id: "star", icon: Star, label: "Top 3", desc: "Ranking entre os 3 melhores", got: false, color: "text-primary-glow" },
  ];
}

const tooltipStyle = {
  background: "oklch(0.2 0.014 250)",
  border: "1px solid oklch(1 0 0 / 8%)",
  borderRadius: 8,
  fontSize: 12,
};

function MetricCard({ m, period }: { m: Metric; period: "daily" | "weekly" }) {
  const Icon = m.icon;
  const target = period === "daily" ? m.daily : m.weekly;
  const value = period === "daily" ? Math.min(m.current, m.daily) : m.current;
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const done = pct >= 100;
  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent">
          <Icon className="h-4 w-4 text-primary-glow" />
        </span>
        {done ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            batida
          </span>
        ) : (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            meta {target}
          </span>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{m.label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">/ {target}</p>
      </div>
      <div className="mt-3">
        <Progress value={pct} className="h-1.5" />
        <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {pct}% da meta {period === "daily" ? "diária" : "semanal"}
        </p>
      </div>
    </div>
  );
}

function FunnelChart({ data }: { data: { label: string; value: number }[] }) {
  const max = data[0]?.value ?? 0;
  return (
    <div className="space-y-2">
      {data.map((s, i) => {
        const widthPct = max > 0 ? (s.value / max) * 100 : 0;
        const conv = i === 0 ? 100 : Math.round((s.value / Math.max(data[i - 1].value, 1)) * 100);
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-xs text-muted-foreground">{s.label}</div>
            <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-accent/50">
              <div
                className="h-full rounded-md transition-all"
                style={{ width: `${widthPct}%`, background: "var(--gradient-primary)" }}
              />
              <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold">
                {s.value}
              </span>
            </div>
            <div className="w-14 shrink-0 text-right text-xs text-muted-foreground">{conv}%</div>
          </div>
        );
      })}
    </div>
  );
}

function RankingTable({ rows, kind }: { rows: Ranked[]; kind: "sdr" | "consultor" }) {
  const max = rows[0]?.points ?? 1;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const pct = (r.points / max) * 100;
        const medal =
          i === 0 ? "text-amber-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-300" : "text-muted-foreground";
        return (
          <div
            key={r.id}
            className="relative overflow-hidden rounded-lg border border-border/70 bg-card/50 p-3"
          >
            <div
              className="absolute inset-y-0 left-0 opacity-10"
              style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
            />
            <div className="relative flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent">
                {i < 3 ? (
                  <Medal className={`h-4 w-4 ${medal}`} />
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  {r.streak >= 5 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                      <Flame className="h-3 w-3" /> {r.streak}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {kind === "consultor"
                    ? `${r.contracts} contratos · ${r.proposals} propostas · ${r.meetings} reuniões`
                    : `${r.meetings} reuniões agendadas · streak ${r.streak}d`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{r.points.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">pts</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetasPage() {
  const user = useRequiredUser();
  const [scope, setScope] = useState<"me" | "team">("me");
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");

  const isAdmin = user.role === "admin";

  // Dados reais — Metas é camada derivada das queries centrais do CRM.
  const dealsQ = useQuery({ queryKey: crmKeys.deals, queryFn: listDeals, staleTime: 15_000 });
  const clientsQ = useQuery({ queryKey: crmKeys.clients, queryFn: listClients, staleTime: 15_000 });
  const stagesQ = useQuery({ queryKey: crmKeys.stages, queryFn: listDealStages, staleTime: 60_000 });
  const prospectsQ = useQuery({ queryKey: crmKeys.prospects, queryFn: loadAllProspects, staleTime: 15_000 });
  const tasksQ = useQuery({ queryKey: crmKeys.tasks, queryFn: loadMapPoints, staleTime: 15_000 });
  const briefingsQ = useQuery({ queryKey: crmKeys.briefings, queryFn: () => listBriefings(), staleTime: 15_000 });
  const dashMetrics = useMemo(
    () => deriveDashboardMetrics({
      deals: dealsQ.data ?? [],
      clients: clientsQ.data ?? [],
      prospects: prospectsQ.data ?? [],
      tasks: tasksQ.data ?? [],
      briefings: briefingsQ.data ?? [],
      stages: stagesQ.data ?? [],
    }),
    [dealsQ.data, clientsQ.data, prospectsQ.data, tasksQ.data, briefingsQ.data, stagesQ.data],
  );
  const k = dashMetrics.kpis;

  const liveMetrics: Metric[] = useMemo(() => {
    const base = scope === "me" ? MY_METRICS : TEAM_METRICS;
    if (!k) return base;
    const overrides: Record<string, number> = {
      empresas: k.prospectsTotal,
      conversas: k.prospectsContacted,
      apresentacoes: k.meetings,
      reunioes: k.meetings,
      propostas: k.proposals,
      contratos: k.dealsWon,
    };
    return base.map((m) => ({ ...m, current: overrides[m.key] ?? m.current }));
  }, [k, scope]);
  const metrics = liveMetrics;

  const funnelData = useMemo(() => {
    if (!dashMetrics.funnel.length) return FUNNEL_FALLBACK;
    return dashMetrics.funnel
      .filter((s) => !s.is_lost)
      .map((s) => ({ label: s.label, value: s.count }));
  }, [dashMetrics.funnel]);

  const myScore = useMemo(() => {
    const total = liveMetrics.reduce((acc, m) => acc + Math.min(m.current / Math.max(m.weekly, 1), 1), 0);
    return Math.round((total / Math.max(liveMetrics.length, 1)) * 100);
  }, [liveMetrics]);

  const pontuacao = useMemo(() => {
    if (!k) return 0;
    return (
      k.prospectsTotal * 10 +
      k.prospectsContacted * 20 +
      k.meetings * 50 +
      k.proposals * 100 +
      k.dealsWon * 300
    );
  }, [k]);

  const badges = useMemo(
    () => buildBadges(
      k ?? { prospectsTotal: 0, prospectsContacted: 0, meetings: 0, proposals: 0, dealsWon: 0 },
      myScore,
    ),
    [k, myScore],
  );

  return (
    <AppShell
      title="Metas"
      subtitle={isAdmin ? "Produtividade individual e da equipe" : "Suas metas e ranking da equipe"}
    >
      {/* Hero gamificação */}
      <section className="surface-card relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "var(--gradient-glow)" }}
        />
        <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-300" />
              <h2 className="text-lg font-bold">
                {user.name.split(" ")[0]}, você está em{" "}
                <span className="text-gradient">{myScore}%</span> da semana
              </h2>
            </div>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Continue batendo metas diárias para subir no ranking e conquistar novas medalhas.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pontuação</p>
                <p className="text-lg font-bold">{pontuacao.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Empresas na base</p>
                <p className="text-lg font-bold">{(k?.prospectsTotal ?? 0).toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contratos fechados</p>
                <p className="flex items-center gap-1 text-lg font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {k?.dealsWon ?? 0}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Medalhas conquistadas
              </p>
              <span className="text-[11px] text-muted-foreground">
                {badges.filter((b) => b.got).length}/{badges.length}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
              {badges.map((b) => {
                const Icon = b.icon;
                return (
                  <div
                    key={b.id}
                    title={b.desc}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition ${
                      b.got
                        ? "border-border bg-card/70"
                        : "border-dashed border-border/60 bg-card/30 opacity-50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${b.got ? b.color : "text-muted-foreground"}`} />
                    <span className="text-[10px] font-medium leading-tight">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Switchers */}
      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isAdmin ? (
          <Tabs value={scope} onValueChange={(v) => setScope(v as "me" | "team")}>
            <TabsList>
              <TabsTrigger value="me">Minhas metas</TabsTrigger>
              <TabsTrigger value="team">Equipe</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <div className="text-sm font-semibold">Minhas metas</div>
        )}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "daily" | "weekly")}>
          <TabsList>
            <TabsTrigger value="daily">Diárias</TabsTrigger>
            <TabsTrigger value="weekly">Semanais</TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      {/* Cards de metas */}
      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <MetricCard key={m.key} m={m} period={period} />
        ))}
      </section>

      {/* Gráficos */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Evolução diária</h3>
          <p className="text-xs text-muted-foreground">Atividades por dia da semana</p>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={EMPTY_DAILY}>
                <CartesianGrid stroke="oklch(1 0 0 / 6%)" vertical={false} />
                <XAxis dataKey="d" stroke="oklch(0.68 0.012 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.68 0.012 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
                <Bar dataKey="empresas" fill="oklch(0.7 0.22 264)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="conversas" fill="oklch(0.72 0.18 200)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="propostas" fill="oklch(0.78 0.16 75)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.7 0.22 264)" }} />Empresas</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.72 0.18 200)" }} />Conversas</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.78 0.16 75)" }} />Propostas</span>
          </div>
        </div>

        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold">Evolução semanal</h3>
          <p className="text-xs text-muted-foreground">% de meta atingida</p>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={EMPTY_WEEKLY}>
                <defs>
                  <linearGradient id="met" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.22 264)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.7 0.22 264)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 6%)" vertical={false} />
                <XAxis dataKey="s" stroke="oklch(0.68 0.012 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.68 0.012 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="atingido" stroke="oklch(0.7 0.22 264)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mt-4 surface-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Funil da semana</h3>
            <p className="text-xs text-muted-foreground">Da prospecção ao fechamento</p>
          </div>
          <span className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Conversão {funnelData[0]?.value ? ((funnelData[funnelData.length - 1].value / funnelData[0].value) * 100).toFixed(1) : "0.0"}%
          </span>
        </div>
        <div className="mt-4">
          {funnelData.length ? (
            <FunnelChart data={funnelData} />
          ) : (
            <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              Sem dados de funil ainda.
            </p>
          )}
        </div>
      </section>

      {/* Rankings */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary-glow" />
              <h3 className="text-sm font-semibold">Ranking Consultores</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">Mês atual</span>
          </div>
          <div className="mt-4">
            {RANKING_CONSULTORES.length ? (
              <RankingTable rows={RANKING_CONSULTORES} kind="consultor" />
            ) : (
              <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                Sem dados de equipe ainda. Cadastre consultores para ver o ranking.
              </p>
            )}
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary-glow" />
              <h3 className="text-sm font-semibold">Ranking SDRs</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">Mês atual</span>
          </div>
          <div className="mt-4">
            {RANKING_SDR.length ? (
              <RankingTable rows={RANKING_SDR} kind="sdr" />
            ) : (
              <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                Sem dados de SDRs ainda. Cadastre SDRs para ver o ranking.
              </p>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
