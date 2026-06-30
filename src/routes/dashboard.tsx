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
import { fetchKpiTrends, wowDelta, EMPTY_TRENDS } from "@/lib/cadence/trends";
import { FEATURES } from "@/config/features";
import { DispatchesPanel } from "@/components/dashboard/DispatchesPanel";

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
      {delta && (
        <p className="-mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">
          vs. semana passada · série 7d
        </p>
      )}
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

  const qTrends = useQuery({
    queryKey: ["dashboard", "trends-14d"] as const,
    queryFn: () => fetchKpiTrends(),
    staleTime: 60_000,
  });
  const trends = qTrends.data ?? EMPTY_TRENDS;

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

  /* North Stars derived */
  const pipelineCount = (m?.resumo.interessados ?? 0) + (m?.resumo.em_negociacao ?? 0);
  const ativos = m?.resumo.ativos ?? 0;
  const respPct = taxa;

  /* Sparklines REAIS — série diária dos últimos 7 dias (oldest -> newest). */
  const sparkContatos = trends.contatos7d;
  const sparkRespostas = trends.respostas7d;
  const sparkAtivos = trends.ativos7d;

  /* Deltas semana atual vs. semana anterior (WoW) calculados sobre dados reais. */
  const deltaContatos = wowDelta(trends.thisWeek.contatos, trends.prevWeek.contatos);
  const deltaRespostas = wowDelta(trends.thisWeek.respostas, trends.prevWeek.respostas);
  const deltaAtivos = wowDelta(trends.thisWeek.ativos, trends.prevWeek.ativos);

  /* Status frase dinâmica */
  const mediaSemana = (m?.contatos.semana ?? 0) / 7;
  const hojeVal = m?.contatos.hoje ?? 0;
  const variacao = mediaSemana > 0 ? ((hojeVal - mediaSemana) / mediaSemana) * 100 : 0;
  const statusFrase = (() => {
    if (!m) return "Carregando indicadores da sua operação…";
    if (mediaSemana === 0 && hojeVal === 0) return "Operação calma — nenhuma atividade registrada hoje.";
    if (variacao >= 10) return `Sua operação está ${Math.round(variacao)}% acima da média dos últimos 7 dias.`;
    if (variacao <= -10) return `Atividade ${Math.round(Math.abs(variacao))}% abaixo da média da semana — vale acelerar.`;
    return "Operação no ritmo da média semanal.";
  })();

  /* Funil unificado */
  // Base = leads importados (prospects com source contendo "import").
  // Preferimos o valor do trends; se indisponível, caímos no resumo.base da RPC.
  const baseN = trends.baseLeads > 0 ? trends.baseLeads : (m?.resumo.base ?? 0);
  // Rollup cumulativo: cada etapa deve ser >= a próxima (funil monotônico).
  // Sem isso, "Responderam" pode ficar menor que "Interessados" porque o RPC
  // só conta quem está atualmente no estágio respondido, ignorando quem já
  // avançou. Garantimos consistência somando os estágios subsequentes.
  const clientesN = ativos;
  const rawNeg = m?.resumo.em_negociacao ?? 0;
  const rawInt = m?.resumo.interessados ?? 0;
  const rawResp = m?.resumo.respondidos ?? 0;
  const rawCont = m?.resumo.contatados ?? 0;
  const negociacaoN = Math.max(rawNeg, clientesN);
  const interessadosN = Math.max(rawInt, negociacaoN);
  const respondidosN = Math.max(rawResp, interessadosN);
  const contatadosN = Math.max(rawCont, respondidosN);
  const safePct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  const stages: FunnelStage[] = [
    { key: "base",   label: "Base",         value: baseN,         convPct: safePct(contatadosN, baseN) },
    { key: "cont",   label: "Contatados",   value: contatadosN,   convPct: safePct(respondidosN, contatadosN) },
    { key: "resp",   label: "Responderam",  value: respondidosN,  convPct: safePct(interessadosN, respondidosN) },
    { key: "inter",  label: "Interessados", value: interessadosN, convPct: safePct(negociacaoN, interessadosN) },
    { key: "neg",    label: "Negociação",   value: negociacaoN,   convPct: safePct(clientesN, negociacaoN) },
    { key: "cli",    label: "Clientes",     value: clientesN,     convPct: null },
  ];
  /* Bottleneck = menor taxa de conversão entre etapas (apenas onde o numerador anterior > 0) */
  let bottleneckIdx: number | null = null;
  let worst = Infinity;
  stages.forEach((s, i) => {
    if (s.convPct !== null && s.value > 0 && s.convPct < worst) {
      worst = s.convPct;
      bottleneckIdx = i;
    }
  });
  const bottleneckLabel = bottleneckIdx !== null ? stages[bottleneckIdx].label : null;

  const setPeriod = (next: Period) =>
    navigate({ to: "/dashboard", search: { p: next } });

  /* Ações prioritárias derivadas dos gargalos */
  type Action = { severity: "high" | "medium" | "info"; title: string; hint: string; cta: string; route: string };
  const actions: Action[] = [];
  const g = m?.gargalos;
  if (g?.cadencia_atrasada)      actions.push({ severity: "high",   title: `${g.cadencia_atrasada} leads com cadência atrasada`, hint: "Disparos previstos e não executados", cta: "Abrir cadência", route: "/cadencia" });
  if (g?.sem_proxima_acao)       actions.push({ severity: "high",   title: `${g.sem_proxima_acao} prospects sem próxima ação`, hint: "Precisam de agendamento de follow-up", cta: "Ver prospecção", route: "/prospeccao" });
  if (g?.clients_parados_15d)    actions.push({ severity: "medium", title: `${g.clients_parados_15d} clientes parados há 15+ dias`, hint: "Reativar relacionamento em Operações", cta: "Ver operações", route: "/operacoes" });
  if (g?.parados_30d)            actions.push({ severity: "medium", title: `${g.parados_30d} leads sem contato há 30+ dias`, hint: "Risco de esfriar a oportunidade", cta: "Ver lista", route: "/cadencia" });
  if (g?.sem_responsavel)        actions.push({ severity: "info",   title: `${g.sem_responsavel} prospects sem responsável`, hint: "Atribuir owner para destravar fluxo", cta: "Atribuir", route: "/prospeccao" });

  return (
    <AppShell
      title={`Olá, ${user.name.split(" ")[0]}`}
      subtitle="Centro de Comando Comercial"
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
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-xs text-rose-200">
          <strong>Sem organização ativa:</strong> selecione uma organização no seletor do header para ver os KPIs. O Dashboard agora exige escopo de organização (sem fallback por usuário).
        </div>
      )}

      {/* 1 — Strategic Header */}
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-400">
            Comando Comercial
          </p>
          <h1 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-[28px] md:leading-tight">
            {statusFrase}
          </h1>
        </div>
        <div className="inline-flex shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {(["hoje","semana","mes","previsao"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPeriod(opt)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                period === opt
                  ? "bg-white/[0.06] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABEL[opt]}
            </button>
          ))}
        </div>
      </header>

      {/* 2 — North Star Metrics */}
      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <NorthStar
          label={isProj ? "Disparos previstos no mês" : `Disparos (${periodLabel.toLowerCase()})`}
          value={contato.value}
          icon={Zap}
          spark={sparkContatos}
          delta={deltaContatos}
          goal={!isProj ? { current: contato.value, target: Math.max(contato.value, m?.contatos.mes ?? 0, 30), label: "Ritmo do mês" } : undefined}
          onClick={() => navigate({ to: "/cadencia" })}
        />
        <NorthStar
          label="Clientes Ativos"
          value={ativos}
          icon={Users}
          spark={sparkAtivos.some((v) => v > 0) ? sparkAtivos : [ativos, ativos, ativos, ativos, ativos, ativos, ativos]}
          delta={deltaAtivos}
          goal={{ current: ativos, target: Math.max(ativos + Math.ceil(ativos * 0.15), 10), label: "Meta trimestral" }}
          onClick={() => navigate({ to: "/operacoes" })}
        />
        <NorthStar
          label="Taxa de Conversão"
          value={respPct.toFixed(1)}
          suffix="%"
          icon={Target}
          spark={sparkRespostas}
          delta={deltaRespostas}
          goal={{ current: Math.round(respPct), target: 20, label: "Benchmark: 20%" }}
          onClick={() => navigate({ to: "/prospeccao" })}
        />
      </section>

      {/* Secondary KPI strip — Pipeline / Negociação */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Pipeline aberto" value={pipelineCount} hint="Interessados + negociação" icon={Wallet} />
        <MiniStat label="Em negociação" value={negociacaoN} hint="Propostas em aberto" icon={TrendingUp} />
        <MiniStat label="Respostas" value={resposta.value} hint={isProj ? "projeção mensal" : periodLabel.toLowerCase()} icon={ArrowUpRight} />
        <MiniStat label="Base total" value={baseN} hint="Empresas cadastradas" icon={Target} />
      </section>

      {/* Painel canônico de disparos (fonte: backend / OWN_SB) */}
      <DispatchesPanel />

      {/* 3 — Funil único horizontal */}
      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">Fluxo de tração comercial</h3>
            {bottleneckLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold text-rose-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                </span>
                Gargalo em {bottleneckLabel}
              </span>
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">acumulado</span>
        </div>
        <Funnel stages={stages} bottleneckIdx={bottleneckIdx} />
      </section>

      {/* 4 — Centro de Ações */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Centro de Ações</h3>
            <p className="text-xs text-muted-foreground">
              {actions.length === 0 ? "Nenhuma ação crítica no radar — operação no eixo." : `${actions.length} ${actions.length === 1 ? "item" : "itens"} aguardando você`}
            </p>
          </div>
          {actions.length > 0 && (
            <button
              type="button"
              onClick={() => navigate({ to: "/cadencia" })}
              className="text-xs font-semibold text-cyan-400 hover:underline"
            >
              Ver tudo
            </button>
          )}
        </div>
        {actions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-muted-foreground">
            Tudo em ordem. Nenhum gargalo detectado para hoje.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {actions.slice(0, 6).map((a, i) => (
              <ActionItem
                key={i}
                severity={a.severity}
                title={a.title}
                hint={a.hint}
                ctaLabel={a.cta}
                onClick={() => navigate({ to: a.route as never })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Footer: aderência (mantido — útil) */}
      {FEATURES.dashboardManagerial ? null : null}
      <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground">
          <span className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Aderência da cadência
          </span>
          <ArrowRight className="h-3.5 w-3.5 transition group-open:rotate-90" />
        </summary>
        <div className="mt-4">
          <FollowupComparativoWidget />
        </div>
      </details>

      {isProj && (
        <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
          Projeção = acumulado do mês + (média diária dos últimos 7 dias × dias restantes).
        </p>
      )}
    </AppShell>
  );
}

function MiniStat({
  label, value, hint, icon: Icon,
}: { label: string; value: number; hint?: string; icon: typeof Target }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{value.toLocaleString("pt-BR")}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
