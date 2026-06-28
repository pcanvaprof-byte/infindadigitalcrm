import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FEATURES } from "@/config/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle, Target, DollarSign, Activity } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from "recharts";
import { fetchBIDashboard, type BIArea, type BIDashboardPayload } from "@/lib/bi/api";
import { AIInsightsPanel } from "@/components/bi/AIInsightsPanel";
import { ExportMenu, type ExportSection } from "@/components/bi/ExportMenu";

export const Route = createFileRoute("/bi")({
  component: BIPageGate,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro BI: {String(error)}</div>
  ),
  notFoundComponent: () => <div className="p-6">Página não encontrada</div>,
});

function BIPageGate() {
  if (!FEATURES.businessIntelligence) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        <strong>Business Intelligence está desativado.</strong>
        <p className="mt-2">
          Reative em <code>src/config/features.ts</code> (<code>FEATURES.businessIntelligence = true</code>).
        </p>
      </div>
    );
  }
  return <BIPage />;
}

const AREAS: Array<{ id: BIArea; label: string; icon: typeof TrendingUp }> = [
  { id: "diretoria",  label: "Diretoria",  icon: Target },
  { id: "comercial",  label: "Comercial",  icon: TrendingUp },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "marketing",  label: "Marketing",  icon: Activity },
  { id: "operacoes",  label: "Operações",  icon: AlertTriangle },
];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function BIPage() {
  const [area, setArea] = useState<BIArea>("diretoria");
  const [data, setData] = useState<BIDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    fetchBIDashboard(area)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [area]);

  const exportSections = useMemo<ExportSection[]>(() => {
    if (!data) return [];
    const out: ExportSection[] = [];
    if (data.kpis) out.push({ title: "KPIs", rows: [data.kpis as unknown as Record<string, unknown>] });
    if (data.forecast) out.push({ title: "Previsão", rows: [data.forecast as unknown as Record<string, unknown>] });
    if (data.funnel) out.push({ title: "Funil", rows: data.funnel as unknown as Array<Record<string, unknown>> });
    if (data.lost?.recentes) out.push({ title: "Perdidos recentes", rows: data.lost.recentes });
    if (data.churn?.detalhes) out.push({ title: "Risco de churn", rows: data.churn.detalhes as unknown as Array<Record<string, unknown>> });
    if (data.best_hours) out.push({ title: "Melhores horarios", rows: data.best_hours as unknown as Array<Record<string, unknown>> });
    if (data.best_channels) out.push({ title: "Canais", rows: data.best_channels as unknown as Array<Record<string, unknown>> });
    if (data.top_campaigns) out.push({ title: "Top campanhas", rows: data.top_campaigns as unknown as Array<Record<string, unknown>> });
    return out;
  }, [data]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Business Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Inteligência de dados, previsões e recomendações por área
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{loading ? "Atualizando..." : "Pronto"}</Badge>
          <ExportMenu filename={`bi-${area}`} sections={exportSections} />
        </div>
      </header>

      <Tabs value={area} onValueChange={(v) => setArea(v as BIArea)}>
        <TabsList className="flex flex-wrap">
          {AREAS.map((a) => {
            const Icon = a.icon;
            return (
              <TabsTrigger key={a.id} value={a.id} className="gap-2">
                <Icon className="h-4 w-4" /> {a.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {AREAS.map((a) => (
          <TabsContent key={a.id} value={a.id} className="mt-4 space-y-5">
            {err && <p className="text-sm text-destructive">{err}</p>}
            {loading && !data && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            )}

            {data?.kpis && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <Kpi label="Clientes ativos" value={String(data.kpis.clientes_ativos)} />
                <Kpi label="MRR" value={fmtBRL(data.kpis.mrr)} />
                <Kpi label="ARR" value={fmtBRL(data.kpis.arr)} />
                <Kpi label="Ticket médio" value={fmtBRL(data.kpis.ticket_medio)} />
                <Kpi label="LTV" value={fmtBRL(data.kpis.ltv)} hint="ticket × 12" />
                <Kpi label="CAC" value={fmtBRL(data.kpis.cac)} hint="custo / novos no mês" />
                <Kpi label="ROI" value={`${data.kpis.roi}%`} />
                <Kpi label="Payback (meses)" value={String(data.kpis.payback_meses)} />
                <Kpi label="Receita realizada" value={fmtBRL(data.kpis.receita_realizada)} />
                <Kpi label="Receita prevista (mês)" value={fmtBRL(data.kpis.receita_prevista_mes)} />
                <Kpi label="Custo marketing" value={fmtBRL(data.kpis.custo_marketing)} />
              </div>
            )}

            {data?.forecast && (
              <Card>
                <CardHeader><CardTitle className="text-base">Previsão de receita</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Kpi label="Pipeline aberto" value={fmtBRL(data.forecast.pipeline_aberto)} />
                  <Kpi label="Conversão hist." value={`${data.forecast.taxa_conversao_historica}%`} />
                  <Kpi label="Previsão 30d" value={fmtBRL(data.forecast.previsao_30d)} />
                  <Kpi label="Previsão 90d" value={fmtBRL(data.forecast.previsao_90d)} />
                  <Kpi label="MRR" value={fmtBRL(data.forecast.mrr)} />
                </CardContent>
              </Card>
            )}

            {data?.funnel && data.funnel.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Gargalos do funil</CardTitle></CardHeader>
                <CardContent style={{ height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.funnel}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="clientes" name="Clientes" fill="hsl(var(--primary))" />
                      <Bar yAxisId="right" dataKey="tempo_medio_dias" name="Tempo médio (dias)" fill="hsl(var(--muted-foreground))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {data?.churn && (
              <Card>
                <CardHeader><CardTitle className="text-base">Risco de churn</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <Kpi label="Alto" value={String(data.churn.alto)} />
                    <Kpi label="Médio" value={String(data.churn.medio)} />
                    <Kpi label="Baixo" value={String(data.churn.baixo)} />
                  </div>
                  {data.churn.detalhes.length > 0 && (
                    <div className="text-sm divide-y rounded-md border">
                      <div className="grid grid-cols-12 px-3 py-2 font-medium bg-muted/30">
                        <span className="col-span-5">Empresa</span>
                        <span className="col-span-3">Valor</span>
                        <span className="col-span-2">Dias inativo</span>
                        <span className="col-span-2">Risco</span>
                      </div>
                      {data.churn.detalhes.slice(0, 10).map((d) => (
                        <div key={d.id} className="grid grid-cols-12 px-3 py-2">
                          <span className="col-span-5 truncate">{d.empresa}</span>
                          <span className="col-span-3">{fmtBRL(d.valor)}</span>
                          <span className="col-span-2">{d.dias_sem_update}</span>
                          <span className="col-span-2">
                            <Badge variant={d.risco === "alto" ? "destructive" : "secondary"}>
                              {d.risco}
                            </Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {data?.best_hours && data.best_hours.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Melhores horários de contato</CardTitle></CardHeader>
                <CardContent style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={data.best_hours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hora" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="enviados" stroke="hsl(var(--muted-foreground))" />
                      <Line type="monotone" dataKey="respondidos" stroke="hsl(var(--primary))" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {data?.best_channels && data.best_channels.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Melhores canais</CardTitle></CardHeader>
                <CardContent style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.best_channels}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="canal" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="enviados" fill="hsl(var(--muted-foreground))" />
                      <Bar dataKey="respondidos" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {data?.top_campaigns && data.top_campaigns.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Campanhas com maior conversão</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-sm divide-y rounded-md border">
                    <div className="grid grid-cols-12 px-3 py-2 font-medium bg-muted/30">
                      <span className="col-span-6">Campanha</span>
                      <span className="col-span-2">Status</span>
                      <span className="col-span-2">Clientes</span>
                      <span className="col-span-2">Receita</span>
                    </div>
                    {data.top_campaigns.map((c, i) => (
                      <div key={i} className="grid grid-cols-12 px-3 py-2">
                        <span className="col-span-6 truncate">{c.campanha}</span>
                        <span className="col-span-2">{c.status}</span>
                        <span className="col-span-2">{c.clientes}</span>
                        <span className="col-span-2">{fmtBRL(c.receita)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {data?.lost && (
              <Card>
                <CardHeader><CardTitle className="text-base">Oportunidades perdidas</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Kpi label="Total perdidos" value={String(data.lost.total)} />
                  <Kpi label="Valor perdido" value={fmtBRL(data.lost.valor_perdido)} />
                </CardContent>
              </Card>
            )}

            <AIInsightsPanel area={a.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}