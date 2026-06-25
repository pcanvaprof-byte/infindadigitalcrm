import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  LineChart,
  PauseCircle,
  Users,
  ClipboardList,
  Settings2,
  Target,
  MessageCircle,
  CalendarClock,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { fetchDashboardMetrics } from "@/modules/operacoes/api";
import { getExecutiveMetrics } from "@/modules/operacoes/fase2.api";
import { OP_PLATAFORMA_LABEL } from "@/modules/operacoes/types";

export const Route = createFileRoute("/operacoes/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Dashboard">
        <DashboardOperacional />
      </AppShell>
    </RequireAuth>
  ),
});

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
          {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-2 text-primary-glow">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function DashboardOperacional() {
  const q = useQuery({ queryKey: ["op-dashboard"], queryFn: fetchDashboardMetrics });
  const ex = useQuery({ queryKey: ["op-exec-metrics"], queryFn: getExecutiveMetrics });
  const m = q.data;
  const e = ex.data;

  return (
    <OperacoesLayout description="Visão consolidada de clientes ativos, verba investida, performance e entregas em andamento.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi
          icon={Users}
          label="Clientes ativos"
          value={`${m?.clientesAtivos ?? 0}`}
          hint={`de ${m?.clientesTotal ?? 0} no total`}
        />
        <Kpi icon={DollarSign} label="Verba mensal" value={fmtMoney(m?.verbaMensal ?? 0)} />
        <Kpi icon={LineChart} label="Gasto acumulado" value={fmtMoney(m?.gastoMes ?? 0)} />
        <Kpi
          icon={CheckCircle2}
          label="ROAS médio"
          value={`${(m?.roasMedio ?? 0).toFixed(2)}x`}
        />
        <Kpi
          icon={AlertTriangle}
          label="Entregas atrasadas"
          value={`${m?.entregasAtrasadas ?? 0}`}
        />
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Operação (visão executiva)</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Kpi icon={ClipboardList} label="Onboarding concluído"
               value={`${e?.onboarding_concluido ?? 0}`}
               hint={`${e?.onboarding_em_configuracao ?? 0} em config · ${e?.onboarding_pendente ?? 0} pendentes`} />
          <Kpi icon={Settings2} label="Implantações concluídas"
               value={`${e?.deployments_concluidos ?? 0}`}
               hint={`${e?.deployments_andamento ?? 0} em andamento · ${e?.deployments_total ?? 0} total`} />
          <Kpi icon={Target} label="Campanhas ativas"
               value={`${e?.campanhas_ativas ?? 0}`}
               hint={`${e?.campanhas_pausadas ?? 0} pausadas · ${e?.campanhas_encerradas ?? 0} encerradas`} />
          <Kpi icon={MessageCircle} label="Interações (30d)" value={`${e?.interacoes_30d ?? 0}`} />
          <Kpi icon={CalendarClock} label="Vencendo em 30d" value={`${e?.contratos_vencendo_30d ?? 0}`} />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Saúde operacional</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Kpi icon={AlertTriangle} label="Clientes sem onboarding" value={`${e?.clientes_sem_onboarding ?? 0}`} />
          <Kpi icon={AlertTriangle} label="Clientes sem campanha ativa" value={`${e?.clientes_sem_campanha_ativa ?? 0}`} />
          <Kpi icon={AlertTriangle} label="Implantação pendente" value={`${e?.clientes_com_implantacao_pendente ?? 0}`} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Próximas entregas (7 dias)</h3>
            <span className="text-[11px] text-muted-foreground">
              {m?.entregasProximas.length ?? 0}
            </span>
          </div>
          {(!m || m.entregasProximas.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhuma entrega programada.</p>
          )}
          <ul className="space-y-2">
            {m?.entregasProximas.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-sm"
              >
                <span className="truncate">{e.titulo}</span>
                <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                  {e.prazo
                    ? new Date(e.prazo + "T00:00").toLocaleDateString("pt-BR")
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Campanhas pausadas</h3>
            <PauseCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          {(!m || m.campanhasPausadas.length === 0) && (
            <p className="text-sm text-muted-foreground">Todas as campanhas estão ativas.</p>
          )}
          <ul className="space-y-2">
            {m?.campanhasPausadas.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-sm"
              >
                <span className="truncate">{c.nome}</span>
                <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                  {OP_PLATAFORMA_LABEL[c.plataforma]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </OperacoesLayout>
  );
}