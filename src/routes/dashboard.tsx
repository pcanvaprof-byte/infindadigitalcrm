import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, useRequiredUser } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Handshake,
  MessageSquare,
  Plus,
  TrendingUp,
  UserX,
} from "lucide-react";
import { cadenceKeys, fetchDashboardMetrics } from "@/lib/cadence/api";

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

function ComparativoLinha({
  label,
  semana,
  mes,
}: {
  label: string;
  semana: number;
  mes: number;
}) {
  // Projeção da semana sobre o mês: semana * (30/7)
  const projecaoMensal = semana * (30 / 7);
  const mediaSemanalDoMes = mes / (30 / 7);
  const delta = mediaSemanalDoMes > 0
    ? ((semana - mediaSemanalDoMes) / mediaSemanalDoMes) * 100
    : semana > 0 ? 100 : 0;
  const positivo = delta >= 0;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-accent/20 px-3 py-2.5">
      <div className="w-40 shrink-0 text-xs font-medium">{label}</div>
      <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Semana: <span className="font-semibold text-foreground tabular-nums">{semana.toLocaleString("pt-BR")}</span>
        </span>
        <span className="text-muted-foreground">
          Mês: <span className="font-semibold text-foreground tabular-nums">{mes.toLocaleString("pt-BR")}</span>
        </span>
        <span className="text-muted-foreground">
          Projeção mensal: <span className="font-semibold text-foreground tabular-nums">{Math.round(projecaoMensal).toLocaleString("pt-BR")}</span>
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            positivo
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-rose-500/15 text-rose-300"
          }`}
          title="Semana atual vs média semanal do mês"
        >
          {positivo ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs média
        </span>
      </div>
    </div>
  );
}

function DashboardPage() {
  const user = useRequiredUser();
  const navigate = useNavigate();

  // ÚNICA fonte: RPC server-side. Zero agregação client-side.
  const q = useQuery({
    queryKey: cadenceKeys.dashboard,
    queryFn: fetchDashboardMetrics,
    staleTime: 30_000,
  });

  const isAdmin = user.role === "admin";
  const subtitle = isAdmin
    ? "Visão consolidada da operação comercial"
    : "Seu desempenho e cadência";

  const m = q.data;
  const errMsg = q.error ? (q.error as Error).message : "";
  const migrationPending =
    errMsg.includes("dashboard_metrics") ||
    errMsg.includes("function") ||
    errMsg.includes("404");

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
      {migrationPending && (
        <div className="surface-card mb-4 border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
          <strong>Migration pendente:</strong> aplique <code>scripts/migrations/20260624_fase6_cadencia.sql</code> no SQL Editor do Supabase. Sem ela o dashboard não tem como agregar os KPIs.
        </div>
      )}

      {/* Operação */}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operação</h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Empresas na base"     value={m?.operacao.base         ?? 0} icon={Building2} />
        <Kpi label="Contatadas"           value={m?.operacao.contatadas   ?? 0} icon={MessageSquare} />
        <Kpi label="Sem resposta"         value={m?.operacao.sem_resposta ?? 0} icon={Clock} tone="warn" />
        <Kpi label="Interessadas"         value={m?.operacao.interessadas ?? 0} icon={Handshake} tone="ok" />
        <Kpi label="Clientes fechados"    value={m?.operacao.clientes     ?? 0} icon={CheckCircle2} tone="ok" />
      </section>

      {/* Cadência */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cadência</h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Contatos hoje"   value={m?.cadencia.hoje   ?? 0} icon={MessageSquare} />
        <Kpi label="Contatos semana" value={m?.cadencia.semana ?? 0} icon={MessageSquare} />
        <Kpi label="Contatos mês"    value={m?.cadencia.mes    ?? 0} icon={MessageSquare} />
        <Kpi label="Taxa resposta"   value={m?.cadencia.taxa_resposta   ?? 0} suffix="%" icon={TrendingUp} />
        <Kpi label="Taxa interesse"  value={m?.cadencia.taxa_interesse  ?? 0} suffix="%" icon={TrendingUp} />
        <Kpi label="Taxa fechamento" value={m?.cadencia.taxa_fechamento ?? 0} suffix="%" icon={CheckCircle2} tone="ok" />
      </section>

      {/* Tentativas de contato (cliques) */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tentativas de contato</h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Tentativas hoje"   value={m?.tentativas?.hoje   ?? 0} icon={MessageSquare} tone="warn" />
        <Kpi label="Tentativas semana" value={m?.tentativas?.semana ?? 0} icon={MessageSquare} tone="warn" />
        <Kpi label="Tentativas mês"    value={m?.tentativas?.mes    ?? 0} icon={MessageSquare} tone="warn" />
      </section>

      {/* Gargalos */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gargalos</h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Follow-ups atrasados"     value={m?.gargalos.atrasados         ?? 0} icon={AlertTriangle} tone="danger" />
        <Kpi label="Parados há 30+ dias"      value={m?.gargalos.parados_30d       ?? 0} icon={Clock}         tone="warn" />
        <Kpi label="Sem responsável"          value={m?.gargalos.sem_responsavel   ?? 0} icon={UserX}         tone="warn" />
        <Kpi label="Deals parados há 15+ dias" value={m?.gargalos.deals_paradas_15d ?? 0} icon={AlertTriangle} tone="warn" />
      </section>

      {/* Conversão */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversão</h3>
      <section className="surface-card p-5">
        <div className="space-y-2">
          <FunilLinha label="Base → Contato"        pct={m?.conversao.base_contato      ?? 0} />
          <FunilLinha label="Contato → Interesse"   pct={m?.conversao.contato_interesse ?? 0} />
          <FunilLinha label="Interesse → Reunião"   pct={m?.conversao.interesse_reuniao ?? 0} />
          <FunilLinha label="Reunião → Proposta"    pct={m?.conversao.reuniao_proposta  ?? 0} />
          <FunilLinha label="Proposta → Cliente"    pct={m?.conversao.proposta_cliente  ?? 0} />
        </div>
      </section>

      {/* Comparativo Semana x Mês */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Comparativo Semana × Mês
      </h3>
      <section className="surface-card space-y-2 p-5">
        <ComparativoLinha
          label="Contatos"
          semana={m?.cadencia.semana ?? 0}
          mes={m?.cadencia.mes ?? 0}
        />
        <ComparativoLinha
          label="Tentativas"
          semana={m?.tentativas?.semana ?? 0}
          mes={m?.tentativas?.mes ?? 0}
        />
        <p className="pt-1 text-[11px] text-muted-foreground">
          O delta compara a semana atual com a média semanal do mês (mês ÷ 4,28). Verde indica ritmo acima da média; vermelho, abaixo.
        </p>
      </section>
    </AppShell>
  );
}
