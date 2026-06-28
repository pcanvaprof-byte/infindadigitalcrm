import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, useRequiredUser } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Plus,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { FollowupComparativoWidget } from "@/components/cadence/FollowupComparativoWidget";
import { fetchDashboardMetrics, type DashboardMetrics } from "@/lib/cadence/api";
import { FEATURES } from "@/config/features";

type Period = "hoje" | "semana" | "mes" | "previsao";
const PERIOD_LABEL: Record<Period, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  previsao: "Previsão",
};

/**
 * Projeção de mês baseada na tendência dos últimos 7 dias (proxy: bucket "semana"),
 * somada ao acumulado real do mês. Evita a distorção da regra de 3 simples
 * (valor/dia*diasDoMês), que infla nos primeiros dias e oscila com fins de semana.
 *
 * Regras:
 *  - Dia < 3 do mês: amostra insuficiente, retorna o acumulado sem projetar.
 *  - Caso contrário: acumulado + (média_diária_7d × dias_restantes).
 */
function projectMonth(mes: number, semana: number): number {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (day < 3) return mes;
  const rate7d = semana / 7;
  const remaining = Math.max(0, daysInMonth - day);
  return Math.round(mes + rate7d * remaining);
}

function pickBucket(
  bucket: { hoje: number; semana: number; mes: number },
  period: Period,
): { value: number; isProjection: boolean } {
  if (period === "hoje")     return { value: bucket.hoje, isProjection: false };
  if (period === "semana")   return { value: bucket.semana, isProjection: false };
  if (period === "mes")      return { value: bucket.mes, isProjection: false };
  return { value: projectMonth(bucket.mes, bucket.semana), isProjection: true };
}

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>) => {
    const p = String(s.p ?? "mes");
    const period: Period = (["hoje","semana","mes","previsao"] as const).includes(p as Period)
      ? (p as Period) : "mes";
    return { p: period };
  },
  head: () => ({
    meta: [{ title: "Dashboard — INFINDA" }],
  }),
  component: () => (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  ),
});

/* ─────────────────────────────────────────────────────────────
   Cockpit components
   ───────────────────────────────────────────────────────────── */

function Sparkline({
  values, positive = true,
}: { values: number[]; positive?: boolean }) {
  const safe = values.length >= 2 ? values : [0, 0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const range = max - min || 1;
  const pts = safe.map((v, i) => {
    const x = (i / (safe.length - 1)) * 100;
    const y = 28 - ((v - min) / range) * 26;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${pts.join(" L ")}`;
  const area = `${d} L 100,30 L 0,30 Z`;
  const stroke = positive ? "text-cyan-400" : "text-rose-400";
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-10 w-full", stroke)}>
      <path d={area} fill="currentColor" fillOpacity="0.08" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NorthStar({
  label, value, suffix, delta, goal, spark, icon: Icon, onClick,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  delta?: { pct: number; up: boolean };
  goal?: { current: number; target: number; label?: string };
  spark: number[];
  icon: typeof Target;
  onClick?: () => void;
}) {
  const goalPct = goal ? Math.min(100, Math.round((goal.current / Math.max(1, goal.target)) * 100)) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-500/30 hover:bg-white/[0.04]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
            <Icon className="h-3.5 w-3.5 text-cyan-400" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
              delta.up
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400",
            )}
          >
            {delta.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta.pct).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <Sparkline values={spark} positive={delta ? delta.up : true} />
      {goal && goalPct !== null && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{goal.label ?? `Meta: ${goal.target.toLocaleString("pt-BR")}`}</span>
            <span className="tabular-nums">{goalPct}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300"
              style={{ width: `${goalPct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

type FunnelStage = { key: string; label: string; value: number; convPct: number | null };

function Funnel({ stages, bottleneckIdx }: { stages: FunnelStage[]; bottleneckIdx: number | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {stages.map((s, i) => {
        const isBottleneck = bottleneckIdx === i;
        const isFirst = i === 0;
        const isLast = i === stages.length - 1;
        return (
          <div key={s.key} className="relative">
            <div
              className={cn(
                "flex h-20 flex-col justify-center px-3 transition-all",
                isFirst && "rounded-l-xl border-l",
                isLast && "rounded-r-xl border-r",
                "border-y border-white/[0.06]",
                isBottleneck
                  ? "border-cyan-500/40 bg-cyan-500/[0.08] shadow-[0_0_24px_rgba(34,211,238,0.08)]"
                  : "bg-white/[0.02]",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  isBottleneck ? "text-cyan-300/80" : "text-muted-foreground/70",
                )}
              >
                {s.label}
              </span>
              <span
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  isLast ? "text-emerald-400" : "text-foreground",
                )}
              >
                {s.value.toLocaleString("pt-BR")}
              </span>
            </div>
            {s.convPct !== null && i < stages.length - 1 && (
              <div className="absolute -right-2.5 top-1/2 z-10 -translate-y-1/2">
                <div
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full border bg-[#0a0c10] text-[9px] font-semibold tabular-nums",
                    isBottleneck
                      ? "border-rose-500/50 text-rose-400"
                      : "border-white/10 text-muted-foreground",
                  )}
                >
                  {s.convPct}%
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActionItem({
  severity, title, hint, ctaLabel, onClick,
}: {
  severity: "high" | "medium" | "info";
  title: string;
  hint: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  const dot =
    severity === "high" ? "bg-rose-500" :
    severity === "medium" ? "bg-amber-500" :
    "bg-cyan-500";
  const ring =
    severity === "high" ? "bg-rose-500/10" :
    severity === "medium" ? "bg-amber-500/10" :
    "bg-cyan-500/10";
  const pulse = severity === "high" ? "animate-pulse" : "";
  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", ring)}>
          <div className={cn("h-2 w-2 rounded-full", dot, pulse)} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClick}
        className="shrink-0 gap-1 border border-white/[0.06] bg-white/[0.03] text-xs font-semibold hover:bg-cyan-500/10 hover:text-cyan-300"
      >
        {ctaLabel}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error);
}

function DashboardPage() {
  const user = useRequiredUser();
  const navigate = useNavigate();
  const search = Route.useSearch() as { p: Period };
  const period: Period = search.p;

  const q = useQuery({
    queryKey: ["dashboard", "v6"] as const,
    queryFn: () => fetchDashboardMetrics(),
    staleTime: 30_000,
  });

  const subtitle = "Seu desempenho e cadência";

  const m = q.data as DashboardMetrics | undefined;
  const errMsg = errorMessage(q.error);
  const noActiveOrg =
    errMsg.includes("no_active_org") || errMsg.includes("org_access_denied");

  const contato = useMemo(
    () => pickBucket(m?.contatos ?? { hoje: 0, semana: 0, mes: 0 }, period),
    [m, period],
  );
  const resposta = useMemo(
    () => pickBucket(m?.respostas ?? { hoje: 0, semana: 0, mes: 0, taxa: 0 } as any, period),
    [m, period],
  );
  const taxa = m?.respostas.taxa ?? 0;
  const isProj = period === "previsao";
  const periodLabel = PERIOD_LABEL[period];
  const showHojeAux = period !== "hoje";
  const showMesAux  = period !== "mes" && period !== "previsao";

  const setPeriod = (next: Period) =>
    navigate({ to: "/dashboard", search: { p: next } });

  return (
    <AppShell
      title={`Olá, ${user.name.split(" ")[0]} 👋`}
      subtitle={subtitle}
      actions={
        <Button
          className="btn-gradient hidden h-9 px-3 text-xs font-semibold sm:inline-flex"
          onClick={() => navigate({ to: "/prospeccao", search: { new: 1 } as never })}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nova oportunidade
        </Button>
      }
    >
      {noActiveOrg && (
        <div className="surface-card mb-4 border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-200">
          <strong>Sem organização ativa:</strong> selecione uma organização no seletor do header para ver os KPIs. O Dashboard agora exige escopo de organização (sem fallback por usuário).
        </div>
      )}

      {/* Filtro global de período */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Período ativo:&nbsp;
          <span className="font-semibold text-foreground">{periodLabel}</span>
          {isProj && (
            <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              projeção
            </span>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-border bg-accent/30 p-1">
          {(["hoje","semana","mes","previsao"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPeriod(opt)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                period === opt
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABEL[opt]}
            </button>
          ))}
        </div>
      </div>

      {/* Operação */}
      {/* Resumo — fonte: prospects + clients (Lifecycle) — valores acumulados */}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Resumo <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground/70">(acumulado)</span>
      </h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Kpi label="Empresas na base"   value={m?.resumo.base          ?? 0} icon={Building2} />
        <Kpi label="Contatados"         value={m?.resumo.contatados    ?? 0} icon={MessageSquare} />
        <Kpi label="Responderam"        value={m?.resumo.respondidos   ?? 0} icon={Inbox} tone="ok" />
        <Kpi label="Novos"              value={m?.resumo.novos         ?? 0} icon={MessageSquare} />
        <Kpi label="Interessados"       value={m?.resumo.interessados  ?? 0} icon={Handshake} tone="ok" />
        <Kpi label="Em negociação"      value={m?.resumo.em_negociacao ?? 0} icon={TrendingUp} />
        <Kpi label="Clientes ativos"    value={m?.resumo.ativos        ?? 0} icon={CheckCircle2} tone="ok" />
      </section>

      {/* Contatos — fonte: prospect_touchpoints — filtrado pelo período */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Contatos realizados <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground/70">({periodLabel.toLowerCase()})</span>
      </h3>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          label={isProj ? "Contatos previstos no mês" : `Contatos (${periodLabel.toLowerCase()})`}
          value={contato.value}
          icon={MessageSquare}
          hint={isProj ? "projeção" : undefined}
        />
        {showHojeAux && <Kpi label="Hoje" value={m?.contatos.hoje ?? 0} icon={MessageSquare} />}
        {showMesAux  && <Kpi label="Mês"  value={m?.contatos.mes  ?? 0} icon={MessageSquare} />}
      </section>
      {isProj && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Projeção = acumulado do mês + (média diária dos últimos 7 dias × dias restantes).
        </p>
      )}

      {/* Respostas — fonte: prospect_touchpoints — filtrado pelo período */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Respostas recebidas <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground/70">({periodLabel.toLowerCase()})</span>
      </h3>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label={isProj ? "Respostas previstas no mês" : `Respostas (${periodLabel.toLowerCase()})`}
          value={resposta.value}
          icon={Inbox}
          tone="ok"
          hint={isProj ? "projeção" : undefined}
        />
        {showHojeAux && <Kpi label="Hoje" value={m?.respostas.hoje ?? 0} icon={Inbox} tone="ok" />}
        {showMesAux  && <Kpi label="Mês"  value={m?.respostas.mes  ?? 0} icon={Inbox} tone="ok" />}
      </section>

      {/* Taxa de resposta é métrica acumulada — fica fora da seção filtrada */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Eficiência <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground/70">(acumulado)</span>
      </h3>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Taxa de resposta" value={taxa} suffix="%" icon={Percent} tone="ok" />
      </section>

      {/* Gargalos — fonte: prospects (cadência) + clients (Lifecycle) */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gargalos</h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Cadência atrasada"        value={m?.gargalos.cadencia_atrasada   ?? 0} icon={AlertTriangle} tone="danger" />
        <Kpi label="Sem contato há 30+ dias"  value={m?.gargalos.parados_30d         ?? 0} icon={Clock}         tone="warn" />
        <Kpi label="Sem responsável"          value={m?.gargalos.sem_responsavel     ?? 0} icon={UserX}         tone="warn" />
        <Kpi label="Clientes parados 15+ dias" value={m?.gargalos.clients_parados_15d ?? 0} icon={Repeat}        tone="warn" />
        <Kpi label="Sem próxima ação"          value={m?.gargalos.sem_proxima_acao    ?? 0} icon={AlertTriangle} tone="warn" />
      </section>

      {/* Funil de conversão — derivado de prospects + clients */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversão</h3>
      <section className="surface-card p-5">
        <div className="space-y-2">
          <FunilLinha label="Base → Contato"        pct={m?.conversao.base_contato      ?? 0} />
          <FunilLinha label="Contato → Resposta"    pct={m?.conversao.contato_resposta  ?? 0} />
          <FunilLinha label="Resposta → Interesse"  pct={m?.conversao.resposta_interesse ?? 0} />
          <FunilLinha label="Interesse → Proposta"  pct={m?.conversao.interesse_proposta ?? 0} />
          <FunilLinha label="Proposta → Ativo"      pct={m?.conversao.proposta_ativo    ?? 0} />
        </div>
      </section>

      {/*
        v7 (dashboard gerencial), v8 (multiusuário) e BI permanecem disponíveis
        no código em src/lib/dashboard/api-v7.ts, api-v8.ts, src/components/dashboard/*
        e src/lib/bi/* — desativados via FEATURES (src/config/features.ts).
        Não importar nem chamar enquanto FEATURES.dashboardManagerial /
        FEATURES.multiUser / FEATURES.businessIntelligence estiverem false.
      */}
      {FEATURES.dashboardManagerial /* placeholder reservado para reativação futura */ ? null : null}

      {/* Follow-ups: previsto x realizado */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Aderência da cadência
      </h3>
      <FollowupComparativoWidget />
    </AppShell>
  );
}
