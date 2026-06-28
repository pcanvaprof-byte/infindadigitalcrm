import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, useRequiredUser } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Award,
  Building2,
  CheckCircle2,
  Clock, DollarSign,
  Handshake, Hourglass,
  Inbox,
  MessageSquare,
  Percent,
  Plus, Activity,
  Repeat,
  TrendingUp, Trophy,
  UserX,
} from "lucide-react";
import { FollowupComparativoWidget } from "@/components/cadence/FollowupComparativoWidget";
import { FiltersBar } from "@/components/dashboard/FiltersBar";
import { MetasDialog } from "@/components/dashboard/MetasDialog";
import {
  EvolucaoDiariaChart, EvolucaoMensalChart, FunilChart, RankingChart,
  ComparacaoChart, MetasChart,
} from "@/components/dashboard/Charts";
import {
  dashboardKeys, fetchDashboardV7,
  type DashboardFilters, type DashboardV7,
} from "@/lib/dashboard/api-v7";

export const Route = createFileRoute("/dashboard")({
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
  label, value, icon: Icon, suffix, tone = "default",
}: {
  label: string;
  value: number | string;
  icon: typeof Building2;
  suffix?: string;
  tone?: "default" | "warn" | "danger" | "ok";
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

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function DashboardPage() {
  const user = useRequiredUser();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<DashboardFilters>({ preset: "mes", owner_name: null });

  const q = useQuery({
    queryKey: dashboardKeys.v7(filters),
    queryFn: () => fetchDashboardV7(filters),
    staleTime: 30_000,
  });

  const isAdmin = user.role === "admin";
  const subtitle = isAdmin
    ? "Visão gerencial consolidada"
    : "Seu desempenho e cadência";

  const m = q.data as DashboardV7 | undefined;
  const errMsg = errorMessage(q.error);
  const noActiveOrg =
    errMsg.includes("no_active_org") || errMsg.includes("org_access_denied");
  const migrationPending =
    !noActiveOrg && (
    errMsg.includes("dashboard_metrics_v7") ||
    errMsg.includes("dashboard_filters_options") ||
    errMsg.includes("organization_id") ||
    errMsg.includes("PGRST202") ||
    errMsg.includes("404")
    );

  return (
    <AppShell
      title={`Olá, ${user.name.split(" ")[0]} 👋`}
      subtitle={subtitle}
      actions={
        <>
          {m && <MetasDialog metas={m.metas} />}
          <Button
          className="btn-gradient hidden h-9 px-3 text-xs font-semibold sm:inline-flex"
          onClick={() => navigate({ to: "/prospeccao", search: { new: 1 } as never })}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nova oportunidade
          </Button>
        </>
      }
    >
      {noActiveOrg && (
        <div className="surface-card mb-4 border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-200">
          <strong>Sem organização ativa:</strong> selecione uma organização no seletor do header para ver os KPIs. O Dashboard agora exige escopo de organização (sem fallback por usuário).
        </div>
      )}
      {migrationPending && (
        <div className="surface-card mb-4 border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
          <strong>Migration pendente:</strong> aplique <code>scripts/migrations/20260744_dashboard_v7_managerial.sql</code> no SQL Editor para ativar o Dashboard Gerencial v7.
        </div>
      )}

      <FiltersBar filters={filters} onChange={setFilters} />

      {/* KPIs gerenciais — fonte: dashboard_metrics_v7 */}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">KPIs gerenciais</h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Taxa de resposta"     value={m?.kpis_gerencial.taxa_resposta ?? 0}    suffix="%" icon={Percent}   tone="ok" />
        <Kpi label="Taxa de conversão"    value={m?.kpis_gerencial.taxa_conversao ?? 0}   suffix="%" icon={TrendingUp} tone="ok" />
        <Kpi label="Taxa de fechamento"   value={m?.kpis_gerencial.taxa_fechamento ?? 0}  suffix="%" icon={Trophy}    tone="ok" />
        <Kpi label="Ticket médio"         value={fmtBRL(m?.kpis_gerencial.ticket_medio ?? 0)} icon={DollarSign} />
        <Kpi label="Receita (período)"    value={fmtBRL(m?.kpis_gerencial.receita_periodo ?? 0)} icon={DollarSign} tone="ok" />
        <Kpi label="Ciclo médio venda"    value={m?.kpis_gerencial.ciclo_medio_venda_d ?? 0}            suffix=" d" icon={Hourglass} />
        <Kpi label="Tempo até fechamento" value={m?.kpis_gerencial.tempo_medio_fechamento_d ?? 0}       suffix=" d" icon={Clock} />
        <Kpi label="Tempo 1ª resposta"    value={m?.kpis_gerencial.tempo_medio_primeira_resposta_d ?? 0} suffix=" d" icon={Activity} />
        <Kpi label="Clientes ganhos"      value={m?.kpis_gerencial.clientes_ganhos ?? 0}   icon={Award}        tone="ok" />
        <Kpi label="Clientes perdidos"    value={m?.kpis_gerencial.clientes_perdidos ?? 0} icon={UserX}        tone="danger" />
        <Kpi
          label="ROI comercial"
          value={m?.kpis_gerencial.roi_comercial == null ? "—" : `${m.kpis_gerencial.roi_comercial}%`}
          icon={Percent}
          tone={(m?.kpis_gerencial.roi_comercial ?? 0) >= 0 ? "ok" : "danger"}
        />
      </section>

      {/* Operação */}
      {/* Resumo — fonte: prospects + clients (Lifecycle) */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo</h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Kpi label="Empresas na base"   value={m?.resumo.base          ?? 0} icon={Building2} />
        <Kpi label="Contatados"         value={m?.resumo.contatados    ?? 0} icon={MessageSquare} />
        <Kpi label="Responderam"        value={m?.resumo.respondidos   ?? 0} icon={Inbox} tone="ok" />
        <Kpi label="Novos"              value={m?.resumo.novos         ?? 0} icon={MessageSquare} />
        <Kpi label="Interessados"       value={m?.resumo.interessados  ?? 0} icon={Handshake} tone="ok" />
        <Kpi label="Em negociação"      value={m?.resumo.em_negociacao ?? 0} icon={TrendingUp} />
        <Kpi label="Clientes ativos"    value={m?.resumo.ativos        ?? 0} icon={CheckCircle2} tone="ok" />
      </section>

      {/* Contatos — fonte: prospect_touchpoints */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Contatos realizados
      </h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        <Kpi label="Hoje"   value={m?.contatos.hoje   ?? 0} icon={MessageSquare} />
        <Kpi label="Semana" value={m?.contatos.semana ?? 0} icon={MessageSquare} />
        <Kpi label="Mês"    value={m?.contatos.mes    ?? 0} icon={MessageSquare} />
      </section>

      {/* Respostas — fonte: prospect_touchpoints (tipo=resposta | resultado=respondido/interessado) */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Respostas recebidas
      </h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Hoje"           value={m?.respostas.hoje   ?? 0} icon={Inbox} tone="ok" />
        <Kpi label="Semana"         value={m?.respostas.semana ?? 0} icon={Inbox} tone="ok" />
        <Kpi label="Mês"            value={m?.respostas.mes    ?? 0} icon={Inbox} tone="ok" />
        <Kpi label="Taxa de resposta" value={m?.respostas.taxa ?? 0} suffix="%" icon={Percent} tone="ok" />
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

      {/* Gráficos gerenciais */}
      {m && (
        <>
          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gráficos gerenciais</h3>
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <EvolucaoDiariaChart data={m.series.evolucao_diaria} />
            <EvolucaoMensalChart data={m.series.evolucao_mensal} />
            <FunilChart data={m.series.funil} />
            <RankingChart data={m.series.ranking} />
            <ComparacaoChart comp={m.comparacao} />
            <MetasChart metas={m.metas} />
          </section>
        </>
      )}

      {/* Follow-ups: previsto x realizado */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Aderência da cadência
      </h3>
      <FollowupComparativoWidget />
    </AppShell>
  );
}
