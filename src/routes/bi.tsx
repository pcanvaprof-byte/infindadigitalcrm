import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FEATURES } from "@/config/features";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle, Target, DollarSign, Activity, Sparkles } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from "recharts";
import { fetchBIDashboard, type BIArea, type BIDashboardPayload } from "@/lib/bi/api";
import { AIInsightsPanel } from "@/components/bi/AIInsightsPanel";
import { ExportMenu, type ExportSection } from "@/components/bi/ExportMenu";
import { ParaBaterMeta } from "@/components/bi/ParaBaterMeta";
import { EvolucaoMes } from "@/components/bi/EvolucaoMes";

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
      <AppShell title="Business Intelligence" subtitle="Centro executivo">
        <div className="p-6 text-sm text-muted-foreground">
          <strong>Business Intelligence está desativado.</strong>
          <p className="mt-2">
            Reative em <code>src/config/features.ts</code> (<code>FEATURES.businessIntelligence = true</code>).
          </p>
        </div>
      </AppShell>
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

const fmtBRL = (n: number | null | undefined) =>
  (Number.isFinite(n as number) ? (n as number) : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const fmtNum = (n: number | null | undefined) =>
  Number.isFinite(n as number) ? String(n) : "0";

const fmtPct = (n: number | null | undefined) =>
  `${Number.isFinite(n as number) ? (n as number) : 0}%`;

// Meta mensal default (em breve: configurável via /metas)
const META_MENSAL = 100_000;

function diasNoMes(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function diaAtual(d = new Date()) {
  return d.getDate();
}

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

function MetaHero({ realizado, ticket }: { realizado: number; ticket: number }) {
  const meta = META_MENSAL;
  const total = diasNoMes();
  const dia = diaAtual();
  const ritmo = dia > 0 ? realizado / dia : 0;
  const projetado = Math.round(ritmo * total);
  const gap = Math.max(0, meta - projetado);
  const pctReal = Math.min(100, Math.round((realizado / meta) * 100));
  const pctIdeal = Math.round((dia / total) * 100);
  const prob = Math.max(0, Math.min(100, Math.round((projetado / meta) * 100)));
  const status = prob >= 100 ? "no ritmo" : prob >= 85 ? "atenção" : "crítico";
  const statusTone =
    status === "no ritmo" ? "text-emerald-400" : status === "atenção" ? "text-amber-400" : "text-rose-400";
  const idealAcum = Math.round((meta * dia) / total);
  const diffIdeal = realizado - idealAcum;
  const contratosFaltam = ticket > 0 ? Math.max(0, Math.ceil((meta - realizado) / ticket)) : 0;

  return (
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
      <CardContent className="p-6 grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
            <Target className="h-3.5 w-3.5" /> Meta do mês
          </div>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-semibold">{fmtBRL(realizado)}</span>
            <span className="text-sm text-muted-foreground">de {fmtBRL(meta)}</span>
            <Badge variant="secondary" className={statusTone}>{pctReal}% atingido</Badge>
          </div>
          <div className="mt-4 h-2.5 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
              style={{ width: `${pctReal}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>Dia {dia} / {total}</span>
            <span>Ideal acumulado: {pctIdeal}%</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Projeção final: <strong className="text-foreground">{fmtBRL(projetado)}</strong> ·
            Probabilidade de bater: <strong className={statusTone}>{prob}%</strong>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 content-start">
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gap p/ meta</p>
            <p className="mt-1 text-xl font-semibold text-rose-400">{fmtBRL(Math.max(0, meta - realizado))}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gap projeção</p>
            <p className={`mt-1 text-xl font-semibold ${gap > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {fmtBRL(gap)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Δ vs ideal</p>
            <p className={`mt-1 text-xl font-semibold ${diffIdeal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {diffIdeal >= 0 ? "+" : ""}{fmtBRL(diffIdeal)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faltam fechar</p>
            <p className="mt-1 text-xl font-semibold">{contratosFaltam} contratos</p>
          </div>
        </div>
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
      .catch((e) => {
        if (cancelled) return;
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "object" && e !== null
              ? ((e as { message?: string; error_description?: string; details?: string }).message
                ?? (e as { error_description?: string }).error_description
                ?? (e as { details?: string }).details
                ?? JSON.stringify(e))
              : String(e);
        setErr(msg);
      })
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
    <AppShell
      title="Business Intelligence"
      subtitle="Cockpit executivo · metas, previsão e ações"
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{loading ? "Atualizando..." : "Pronto"}</Badge>
          <ExportMenu filename={`bi-${area}`} sections={exportSections} />
        </div>
      }
    >
    <div className="space-y-5">

      <Tabs value={area} onValueChange={(v) => setArea(v as BIArea)}>
        <nav
          aria-label="Áreas de BI"
          className="flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card/60 p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {AREAS.map((a) => {
            const Icon = a.icon;
            const active = area === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setArea(a.id)}
                className={`group inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all ${
                  active
                    ? "border-primary/50 bg-primary/15 text-foreground shadow-sm"
                    : "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                <span>{a.label}</span>
              </button>
            );
          })}
        </nav>

        {AREAS.map((a) => (
          <TabsContent key={a.id} value={a.id} className="mt-4 space-y-5">
            {err && <p className="text-sm text-destructive">{err}</p>}
            {loading && !data && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            )}

            {a.id === "diretoria" && data?.kpis && (
              <>
                <MetaHero
                  realizado={data.kpis.receita_realizada ?? 0}
                  ticket={data.kpis.ticket_medio ?? 0}
                />
                <div className="grid gap-5 lg:grid-cols-2">
                  <ParaBaterMeta
                    meta={META_MENSAL}
                    realizado={data.kpis.receita_realizada ?? 0}
                    ticket={data.kpis.ticket_medio ?? 0}
                    taxaConversao={data.forecast?.taxa_conversao_historica ?? null}
                  />
                  <EvolucaoMes
                    meta={META_MENSAL}
                    realizado={data.kpis.receita_realizada ?? 0}
                  />
                </div>
              </>
            )}

            {data?.kpis && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <Kpi label="Clientes ativos" value={fmtNum(data.kpis.clientes_ativos)} />
                <Kpi label="MRR" value={fmtBRL(data.kpis.mrr)} />
                <Kpi label="ARR" value={fmtBRL(data.kpis.arr)} />
                <Kpi label="Ticket médio" value={fmtBRL(data.kpis.ticket_medio)} />
                <Kpi label="LTV" value={fmtBRL(data.kpis.ltv)} hint="ticket × 12" />
                <Kpi label="CAC" value={fmtBRL(data.kpis.cac)} hint="custo / novos no mês" />
                <Kpi label="ROI" value={fmtPct(data.kpis.roi)} />
                <Kpi label="Payback (meses)" value={fmtNum(data.kpis.payback_meses)} />
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
                  <Kpi label="Conversão hist." value={fmtPct(data.forecast.taxa_conversao_historica)} />
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
                    <Kpi label="Alto" value={fmtNum(data.churn.alto)} />
                    <Kpi label="Médio" value={fmtNum(data.churn.medio)} />
                    <Kpi label="Baixo" value={fmtNum(data.churn.baixo)} />
                  </div>
                  {(data.churn.detalhes?.length ?? 0) > 0 && (
                    <div className="text-sm divide-y rounded-md border">
                      <div className="grid grid-cols-12 px-3 py-2 font-medium bg-muted/30">
                        <span className="col-span-5">Empresa</span>
                        <span className="col-span-3">Valor</span>
                        <span className="col-span-2">Dias inativo</span>
                        <span className="col-span-2">Risco</span>
                      </div>
                      {(data.churn.detalhes ?? []).slice(0, 10).map((d) => (
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
                  <Kpi label="Total perdidos" value={fmtNum(data.lost.total)} />
                  <Kpi label="Valor perdido" value={fmtBRL(data.lost.valor_perdido)} />
                </CardContent>
              </Card>
            )}

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Insights executivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AIInsightsPanel area={a.id} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
    </AppShell>
  );
}