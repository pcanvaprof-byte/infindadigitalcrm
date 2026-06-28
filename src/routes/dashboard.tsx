import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, useRequiredUser } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Handshake,
  Inbox,
  MessageSquare,
  Percent,
  Plus,
  Repeat,
  TrendingUp,
  UserX,
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
function projectMonth(mes: number, ultimos7d: number): number {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (day < 3) return mes;
  const rate7d = ultimos7d / 7;
  const remaining = Math.max(0, daysInMonth - day);
  return Math.round(mes + rate7d * remaining);
}

function pickBucket(
  bucket: { hoje: number; semana: number; mes: number; ultimos_7d?: number },
  period: Period,
): { value: number; isProjection: boolean } {
  if (period === "hoje")     return { value: bucket.hoje, isProjection: false };
  if (period === "semana")   return { value: bucket.semana, isProjection: false };
  if (period === "mes")      return { value: bucket.mes, isProjection: false };
  return { value: projectMonth(bucket.mes, bucket.ultimos_7d ?? bucket.semana), isProjection: true };
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

function Kpi({
  label, value, icon: Icon, suffix, tone = "default", hint,
}: {
  label: string;
  value: number | string;
  icon: typeof Building2;
  suffix?: string;
  tone?: "default" | "warn" | "danger" | "ok";
  hint?: string;
}) {
  const ring =
    tone === "warn"   ? "border-amber-500/30" :
    tone === "danger" ? "border-rose-500/30"  :
    tone === "ok"     ? "border-emerald-500/30" :
                        "border-border";
  return (
    <div className={`surface-card p-4 border ${ring}`}>
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent">
          <Icon className="h-4 w-4 text-primary-glow" />
        </span>
        {hint && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            {hint}
          </span>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

function FunilLinha({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-44 shrink-0 text-xs text-muted-foreground">{label}</div>
      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-accent/50">
        <div
          className="h-full rounded-md"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: "var(--gradient-primary)" }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-[11px] font-semibold">
          {pct.toLocaleString("pt-BR")}%
        </span>
      </div>
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
    () => pickBucket(m?.contatos ?? { hoje: 0, semana: 0, mes: 0, ultimos_7d: 0 }, period),
    [m, period],
  );
  const resposta = useMemo(
    () => pickBucket(m?.respostas ?? { hoje: 0, semana: 0, mes: 0, ultimos_7d: 0, taxa: 0 } as any, period),
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
