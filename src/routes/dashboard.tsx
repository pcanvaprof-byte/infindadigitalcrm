import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, useRequiredUser } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  FileText,
  Inbox,
  MessageSquare,
  Phone,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { crmKeys, listDeals, listClients, listDealStages } from "@/lib/crm/api";
import { loadAllProspects } from "@/lib/prospects-api";
import { loadMapPoints } from "@/lib/tasks-map-api";
import { listBriefings } from "@/lib/briefings/api";
import { deriveDashboardMetrics, type DashboardKPIs, type FunnelStage } from "@/lib/dashboard/api";

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

// Targets ainda são alvos comerciais; valores vêm de getDashboardKPIs.
const KPI_TARGETS = {
  prospects: 150,
  contacted: 60,
  conversations: 120,
  meetings: 30,
  proposals: 12,
  clients: 6,
  dealsWon: 6,
  revenue: 100000,
  avgTicket: 15000,
};

type KpiItem = {
  label: string;
  value: number;
  target: number;
  icon: typeof Building2;
  money?: boolean;
};

function kpisFromData(d?: DashboardKPIs): KpiItem[] {
  const k = d ?? {
    prospectsTotal: 0, prospectsContacted: 0, conversationsStarted: 0, clientsTotal: 0,
    dealsOpen: 0, dealsWon: 0, dealsLost: 0, revenueWon: 0,
    pipelineValue: 0, avgTicket: 0, meetings: 0, proposals: 0,
    briefingsTotal: 0, tasksTotal: 0,
  };
  return [
    { label: "Empresas Prospectadas", value: k.prospectsTotal, target: KPI_TARGETS.prospects, icon: Building2 },
    { label: "Contatos Realizados", value: k.prospectsContacted, target: KPI_TARGETS.contacted, icon: MessageSquare },
    { label: "Conversas Iniciadas", value: k.conversationsStarted, target: KPI_TARGETS.conversations, icon: MessageSquare },
    { label: "Reuniões", value: k.meetings, target: KPI_TARGETS.meetings, icon: CalendarClock },
    { label: "Propostas", value: k.proposals, target: KPI_TARGETS.proposals, icon: FileText },
    { label: "Clientes", value: k.clientsTotal, target: KPI_TARGETS.clients, icon: CheckCircle2 },
    { label: "Deals Ganhos", value: k.dealsWon, target: KPI_TARGETS.dealsWon, icon: Phone },
    { label: "Receita Gerada", value: k.revenueWon, target: KPI_TARGETS.revenue, icon: DollarSign, money: true },
    { label: "Ticket Médio", value: k.avgTicket, target: KPI_TARGETS.avgTicket, icon: TrendingUp, money: true },
  ];
}

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);

function KpiCard({ k }: { k: KpiItem }) {
  const Icon = k.icon;
  const pct = k.target > 0 ? Math.min(100, Math.round((k.value / k.target) * 100)) : 0;
  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent">
          <Icon className="h-4 w-4 text-primary-glow" />
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Meta {k.money ? brl(k.target) : k.target.toLocaleString("pt-BR")}
        </span>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{k.label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">
        {k.money ? brl(k.value) : k.value.toLocaleString("pt-BR")}
      </p>
      <div className="mt-3">
        <Progress value={pct} className="h-1.5" />
        <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {pct}% da meta
        </p>
      </div>
    </div>
  );
}

function EmptyPanel({
  title,
  subtitle,
  hint,
}: {
  title: string;
  subtitle: string;
  hint: string;
}) {
  return (
    <div className="surface-card flex flex-col p-5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent">
          <Inbox className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium">Sem dados ainda</p>
        <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function DashboardPage() {
  const user = useRequiredUser();
  const navigate = useNavigate();

  // Dashboard é camada derivada — consome apenas as queries centrais do CRM.
  const dealsQ = useQuery({ queryKey: crmKeys.deals, queryFn: listDeals, staleTime: 15_000 });
  const clientsQ = useQuery({ queryKey: crmKeys.clients, queryFn: listClients, staleTime: 15_000 });
  const stagesQ = useQuery({ queryKey: crmKeys.stages, queryFn: listDealStages, staleTime: 60_000 });
  const prospectsQ = useQuery({ queryKey: crmKeys.prospects, queryFn: loadAllProspects, staleTime: 15_000 });
  const tasksQ = useQuery({ queryKey: crmKeys.tasks, queryFn: loadMapPoints, staleTime: 15_000 });
  const briefingsQ = useQuery({ queryKey: crmKeys.briefings, queryFn: () => listBriefings(), staleTime: 15_000 });

  const metrics = useMemo(
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
  const kpis = kpisFromData(metrics.kpis);
  const funnel: FunnelStage[] = metrics.funnel;
  const totalDeals = funnel.reduce((s, f) => s + f.count, 0);

  const isAdmin = user.role === "admin";
  const subtitle = isAdmin
    ? "Visão consolidada da operação comercial"
    : "Seu desempenho e metas pessoais";

  return (
    <AppShell
      title={`Olá, ${user.name.split(" ")[0]} 👋`}
      subtitle={subtitle}
      actions={
        <Button
          className="btn-gradient hidden h-9 px-3 text-xs font-semibold sm:inline-flex"
          onClick={() => navigate({ to: "/prospeccao", search: { new: 1 } as any })}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nova oportunidade
        </Button>
      }
    >
      {/* KPIs */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} k={k} />
        ))}
      </section>

      {/* Metas */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { label: "Meta Diária", target: "25 empresas/dia" },
          { label: "Meta Semanal", target: "150 empresas/semana" },
          { label: "Meta Mensal", target: "R$ 138.000 em receita" },
        ].map((g) => (
          <div key={g.label} className="surface-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary-glow" />
                <span className="text-sm font-medium">{g.label}</span>
              </div>
              <span className="text-sm font-bold">0%</span>
            </div>
            <Progress value={0} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">{g.target}</p>
          </div>
        ))}
      </section>

      {/* Funil Comercial */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {funnel.length === 0 || totalDeals === 0 ? (
            <EmptyPanel
              title="Funil Comercial"
              subtitle="Da prospecção ao fechamento"
              hint="Cadastre oportunidades no CRM para visualizar o funil em tempo real."
            />
          ) : (
            <div className="surface-card p-5">
              <h3 className="text-sm font-semibold">Funil Comercial</h3>
              <p className="text-xs text-muted-foreground">Distribuição por estágio (em tempo real)</p>
              <div className="mt-4 space-y-2">
                {funnel.map((s) => {
                  const max = Math.max(...funnel.map((x) => x.count), 1);
                  const pct = (s.count / max) * 100;
                  return (
                    <div key={s.stageId} className="flex items-center gap-3">
                      <div className="w-32 shrink-0 text-xs text-muted-foreground">{s.label}</div>
                      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-accent/50">
                        <div className="h-full rounded-md" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
                        <span className="absolute inset-0 flex items-center px-3 text-[11px] font-semibold">{s.count}</span>
                      </div>
                      <div className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">{brl(s.value)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <EmptyPanel
          title="Receita Mensal"
          subtitle="Histórico de fechamentos"
          hint="Os contratos fechados alimentam este gráfico."
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EmptyPanel
            title={isAdmin ? "Performance por Consultor" : "Sua Performance"}
            subtitle="Contratos e propostas"
            hint={
              isAdmin
                ? "A comparação entre consultores aparecerá aqui."
                : "Suas propostas e contratos fechados aparecerão aqui."
            }
          />
        </div>
        <EmptyPanel
          title="Clientes por Segmento"
          subtitle="Distribuição da carteira"
          hint="Adicione clientes no CRM para ver a distribuição."
        />
      </section>
    </AppShell>
  );
}
