import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import { Loader2 } from "lucide-react";
import {
  fetchComercialDaily,
  fetchFinanceiroMonthly,
  fetchMarketingDispatches,
  fetchMarketingChannelMix,
  fetchOperacoesDaily,
  fetchOperacoesStatusMix,
} from "@/lib/bi/charts";
import { useDrillDown } from "@/hooks/useDrillDown";
import type { ResolvedPeriod } from "@/lib/bi/period";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
};

function ChartShell({
  title, subtitle, isLoading, isEmpty, emptyText, height = 280, children,
}: {
  title: string;
  subtitle?: string;
  isLoading: boolean;
  isEmpty: boolean;
  emptyText: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent style={{ height }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground text-center px-4">
            {emptyText}
          </div>
        ) : (
          <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- COMERCIAL ----------------
export function ComercialCharts({ period }: { period?: ResolvedPeriod } = {}) {
  const drill = useDrillDown();
  const q = useQuery({
    queryKey: ["bi", "charts", "comercial-daily", period?.key ?? "default"],
    queryFn: () => fetchComercialDaily(Math.min(60, Math.max(7, period?.days ?? 14))),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const data = q.data ?? [];
  const empty = data.every((d) => d.novosLeads === 0 && d.touchpoints === 0);
  return (
    <ChartShell
      title={`Atividade comercial — ${period?.label ?? "últimos 14 dias"}`}
      subtitle="Novos leads cadastrados e touchpoints (outbound) por dia"
      isLoading={q.isLoading}
      isEmpty={empty}
      emptyText="Sem leads ou touchpoints no período selecionado."
    >
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="dia" fontSize={11} />
        <YAxis fontSize={11} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="novosLeads"
          name="Novos leads"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
          onClick={() =>
            drill.open({
              id: "prospects-new",
              kind: "prospects-new",
              title: "Novos leads no período",
              crumb: "Comercial · Novos leads",
            })
          }
          cursor="pointer"
        />
        <Bar
          dataKey="touchpoints"
          name="Touchpoints"
          fill="hsl(var(--muted-foreground))"
          radius={[4, 4, 0, 0]}
          onClick={() =>
            drill.open({
              id: "touchpoints",
              kind: "touchpoints",
              title: "Touchpoints no período",
              crumb: "Comercial · Touchpoints",
            })
          }
          cursor="pointer"
        />
      </BarChart>
    </ChartShell>
  );
}

// ---------------- FINANCEIRO ----------------
export function FinanceiroCharts({ period }: { period?: ResolvedPeriod } = {}) {
  const drill = useDrillDown();
  // Quantidade de meses derivada do período: mais curto = mais detalhe, máx 12.
  const months = Math.max(3, Math.min(12, Math.ceil((period?.days ?? 180) / 30) + 2));
  const q = useQuery({
    queryKey: ["bi", "charts", "financeiro-monthly", months, period?.key ?? "default"],
    queryFn: () => fetchFinanceiroMonthly(months),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const data = q.data ?? [];
  const empty = data.every((d) => d.receita === 0 && d.contratos === 0);
  return (
    <ChartShell
      title={`Receita assinada — últimos ${months} meses`}
      subtitle={`Período: ${period?.label ?? "padrão"} · soma do valor de contrato por mês`}
      isLoading={q.isLoading}
      isEmpty={empty}
      emptyText="Sem contratos assinados no período."
      height={300}
    >
      <AreaChart
        data={data}
        onClick={() =>
          drill.open({
            id: "contracts",
            kind: "contracts",
            title: "Contratos no período",
            crumb: "Financeiro · Contratos",
          })
        }
      >
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="mes" fontSize={11} />
        <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
        <Tooltip {...tooltipStyle} formatter={(v: number, name: string) =>
          name === "Receita" ? [fmtBRL(Number(v)), name] : [v, name]
        } />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="receita"
          name="Receita"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#rev)"
        />
        <Line type="monotone" dataKey="contratos" name="Contratos" stroke="hsl(var(--muted-foreground))" />
      </AreaChart>
    </ChartShell>
  );
}

// ---------------- MARKETING ----------------
export function MarketingCharts({ period }: { period?: ResolvedPeriod } = {}) {
  const drill = useDrillDown();
  const disp = useQuery({
    queryKey: ["bi", "charts", "mkt-dispatches", period?.key ?? "default"],
    queryFn: () => fetchMarketingDispatches(Math.min(60, Math.max(7, period?.days ?? 14))),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const mix = useQuery({
    queryKey: ["bi", "charts", "mkt-channel-mix", period?.key ?? "default"],
    queryFn: () => fetchMarketingChannelMix(Math.min(120, Math.max(7, period?.days ?? 30))),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const dispData = disp.data ?? [];
  const mixData = mix.data ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartShell
        title={`Disparos de cadência — ${period?.label ?? "últimos 14 dias"}`}
        subtitle="Mensagens enviadas pela máquina de cadência"
        isLoading={disp.isLoading}
        isEmpty={dispData.every((d) => d.disparos === 0)}
        emptyText="Nenhum disparo registrado no período."
      >
        <LineChart
          data={dispData}
          onClick={() =>
            drill.open({
              id: "dispatches",
              kind: "dispatches",
              title: "Disparos de cadência",
              crumb: "Marketing · Disparos",
            })
          }
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="dia" fontSize={11} />
          <YAxis fontSize={11} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="disparos"
            name="Disparos"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartShell>

      <ChartShell
        title={`Mix de canais — ${period?.label ?? "últimos 30 dias"}`}
        subtitle="Touchpoints por tipo (whatsapp, ligação, e-mail, reunião…)"
        isLoading={mix.isLoading}
        isEmpty={mixData.length === 0}
        emptyText="Sem touchpoints registrados no período."
      >
        <BarChart data={mixData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" fontSize={11} allowDecimals={false} />
          <YAxis type="category" dataKey="canal" fontSize={11} width={90} />
          <Tooltip {...tooltipStyle} />
          <Bar
            dataKey="total"
            name="Touchpoints"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(d: { canal?: string }) =>
              drill.open({
                id: `touchpoints-${d?.canal ?? "all"}`,
                kind: "touchpoints-channel",
                title: `Touchpoints — ${d?.canal ?? "canal"}`,
                params: { canal: d?.canal },
                crumb: `Marketing · ${d?.canal ?? "Canal"}`,
              })
            }
          />
        </BarChart>
      </ChartShell>
    </div>
  );
}

// ---------------- OPERAÇÕES ----------------
export function OperacoesCharts({ period }: { period?: ResolvedPeriod } = {}) {
  const drill = useDrillDown();
  const daily = useQuery({
    queryKey: ["bi", "charts", "ops-daily", period?.key ?? "default"],
    queryFn: () => fetchOperacoesDaily(Math.min(60, Math.max(7, period?.days ?? 14))),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const mix = useQuery({
    queryKey: ["bi", "charts", "ops-status"],
    queryFn: () => fetchOperacoesStatusMix(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const dailyData = daily.data ?? [];
  const mixData = mix.data ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartShell
        title={`Operação — ${period?.label ?? "últimos 14 dias"}`}
        subtitle="Novos contratos assinados vs touchpoints diários"
        isLoading={daily.isLoading}
        isEmpty={dailyData.every((d) => d.novosContratos === 0 && d.touchpoints === 0)}
        emptyText="Sem movimentação operacional no período."
      >
        <BarChart data={dailyData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="dia" fontSize={11} />
          <YAxis yAxisId="left" fontSize={11} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" fontSize={11} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            yAxisId="left"
            dataKey="novosContratos"
            name="Contratos"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={() =>
              drill.open({
                id: "ops-contracts",
                kind: "contracts",
                title: "Contratos no período",
                crumb: "Operações · Contratos",
              })
            }
          />
          <Bar
            yAxisId="right"
            dataKey="touchpoints"
            name="Touchpoints"
            fill="hsl(var(--muted-foreground))"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={() =>
              drill.open({
                id: "ops-touchpoints",
                kind: "touchpoints",
                title: "Touchpoints no período",
                crumb: "Operações · Touchpoints",
              })
            }
          />
        </BarChart>
      </ChartShell>

      <ChartShell
        title="Distribuição de status — contratos"
        subtitle="Composição atual da base de contratos"
        isLoading={mix.isLoading}
        isEmpty={mixData.length === 0}
        emptyText="Sem contratos cadastrados."
      >
        <BarChart data={mixData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" fontSize={11} allowDecimals={false} />
          <YAxis type="category" dataKey="status" fontSize={11} width={110} />
          <Tooltip {...tooltipStyle} />
          <Bar
            dataKey="total"
            name="Contratos"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(d: { status?: string }) =>
              drill.open({
                id: `ops-status-${d?.status ?? "all"}`,
                kind: "contracts-status",
                title: `Contratos — ${d?.status ?? "status"}`,
                params: { status: d?.status },
                crumb: `Operações · ${d?.status ?? "Status"}`,
              })
            }
          />
        </BarChart>
      </ChartShell>
    </div>
  );
}