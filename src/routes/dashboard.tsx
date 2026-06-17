import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

// Metas (targets) preservadas — valores reais zerados até integração real
const KPIS = [
  { label: "Empresas Visitadas", value: 0, target: 150, icon: Building2 },
  { label: "Conversas Qualificadas", value: 0, target: 60, icon: MessageSquare },
  { label: "Apresentações", value: 0, target: 30, icon: Phone },
  { label: "Reuniões", value: 0, target: 12, icon: CalendarClock },
  { label: "Propostas", value: 0, target: 6, icon: FileText },
  { label: "Contratos Fechados", value: 0, target: 6, icon: CheckCircle2 },
  { label: "Receita Gerada", value: 0, target: 100000, icon: DollarSign, money: true },
  { label: "Ticket Médio", value: 0, target: 15000, icon: TrendingUp, money: true },
];

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);

function KpiCard({ k }: { k: (typeof KPIS)[number] }) {
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
        {KPIS.map((k) => (
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

      {/* Painéis vazios */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EmptyPanel
            title="Funil Comercial"
            subtitle="Da prospecção ao fechamento"
            hint={
              isAdmin
                ? "Quando consultores começarem a registrar oportunidades, o funil aparecerá aqui."
                : "Cadastre suas primeiras oportunidades no CRM para acompanhar seu funil."
            }
          />
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
