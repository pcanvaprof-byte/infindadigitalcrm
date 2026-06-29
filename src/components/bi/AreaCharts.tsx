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
export function ComercialCharts() {
  const q = useQuery({
    queryKey: ["bi", "charts", "comercial-daily"],
    queryFn: () => fetchComercialDaily(14),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const data = q.data ?? [];
  const empty = data.every((d) => d.novosLeads === 0 && d.touchpoints === 0);
  return (
    <ChartShell
      title="Atividade comercial — últimos 14 dias"
      subtitle="Novos leads cadastrados e touchpoints (outbound) por dia"
      isLoading={q.isLoading}
      isEmpty={empty}
      emptyText="Sem leads ou touchpoints nos últimos 14 dias."
    >
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="dia" fontSize={11} />
        <YAxis fontSize={11} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="novosLeads" name="Novos leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="touchpoints" name="Touchpoints" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartShell>
  );
}

// ---------------- FINANCEIRO ----------------
export function FinanceiroCharts() {
  const q = useQuery({
    queryKey: ["bi", "charts", "financeiro-monthly"],
    queryFn: () => fetchFinanceiroMonthly(6),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const data = q.data ?? [];
  const empty = data.every((d) => d.receita === 0 && d.contratos === 0);
  return (
    <ChartShell
      title="Receita assinada — últimos 6 meses"
      subtitle="Soma do valor de contrato por mês de assinatura"
      isLoading={q.isLoading}
      isEmpty={empty}
      emptyText="Sem contratos assinados no período."
      height={300}
    >
      <AreaChart data={data}>
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
export function MarketingCharts() {
  const disp = useQuery({
    queryKey: ["bi", "charts", "mkt-dispatches"],
    queryFn: () => fetchMarketingDispatches(14),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const mix = useQuery({
    queryKey: ["bi", "charts", "mkt-channel-mix"],
    queryFn: () => fetchMarketingChannelMix(30),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const dispData = disp.data ?? [];
  const mixData = mix.data ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartShell
        title="Disparos de cadência — últimos 14 dias"
        subtitle="Mensagens enviadas pela máquina de cadência"
        isLoading={disp.isLoading}
        isEmpty={dispData.every((d) => d.disparos === 0)}
        emptyText="Nenhum disparo registrado nos últimos 14 dias."
      >
        <LineChart data={dispData}>
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
        title="Mix de canais — últimos 30 dias"
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
          <Bar dataKey="total" name="Touchpoints" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartShell>
    </div>
  );
}

// ---------------- OPERAÇÕES ----------------
export function OperacoesCharts() {
  const daily = useQuery({
    queryKey: ["bi", "charts", "ops-daily"],
    queryFn: () => fetchOperacoesDaily(14),
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
        title="Operação — últimos 14 dias"
        subtitle="Novos contratos assinados vs touchpoints diários"
        isLoading={daily.isLoading}
        isEmpty={dailyData.every((d) => d.novosContratos === 0 && d.touchpoints === 0)}
        emptyText="Sem movimentação operacional nos últimos 14 dias."
      >
        <BarChart data={dailyData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="dia" fontSize={11} />
          <YAxis yAxisId="left" fontSize={11} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" fontSize={11} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="novosContratos" name="Contratos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="touchpoints" name="Touchpoints" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
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
          <Bar dataKey="total" name="Contratos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartShell>
    </div>
  );
}