import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, Award, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { fetchMeiosProspeccao, SOURCE_LABEL, type ChannelMetrics, type ProspectSource } from "@/lib/bi/meios";
import type { ResolvedPeriod } from "@/lib/bi/period";
import { useDrillDown } from "@/hooks/useDrillDown";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function progressTone(pct: number): string {
  if (pct >= 80) return "[&>div]:bg-[hsl(var(--success))]";
  if (pct >= 40) return "[&>div]:bg-[hsl(var(--warning))]";
  return "[&>div]:bg-[hsl(var(--destructive))]";
}

function ChannelRow({
  c,
  onDrill,
}: {
  c: ChannelMetrics;
  onDrill: (s: ProspectSource, label: string) => void;
}) {
  const pct = c.meta > 0 ? Math.min(100, Math.round((c.realizado / c.meta) * 100)) : 0;
  return (
    <button
      type="button"
      onClick={() => onDrill(c.source, c.label)}
      className="group grid w-full grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.9fr_0.9fr] items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-card/70"
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{c.label}</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {c.realizado}/{c.meta || "—"}
          </span>
        </div>
        <Progress value={pct} className={`h-1.5 ${progressTone(pct)}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{pct}%</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Leads <span className="ml-1 text-foreground tabular-nums">{c.leads}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Reun. <span className="ml-1 text-foreground tabular-nums">{c.reunioes}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Prop. <span className="ml-1 text-foreground tabular-nums">{c.propostas}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Contr. <span className="ml-1 text-foreground tabular-nums">{c.contratos}</span>
        <span className="ml-2 text-[10px] text-muted-foreground/80">({c.conversao}%)</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums text-foreground">{fmtBRL(c.receita)}</div>
        <div className="text-[10px] text-muted-foreground">
          MRR {fmtBRL(c.recorrencia)} · TM {fmtBRL(c.ticketMedio)}
        </div>
      </div>
    </button>
  );
}

export function MeiosProspeccaoPanel({ period }: { period: ResolvedPeriod }) {
  const dd = useDrillDown();

  const query = useQuery({
    queryKey: ["bi", "meios", period.key, period.from.toISOString(), period.to.toISOString()],
    queryFn: () => fetchMeiosProspeccao(period),
    staleTime: 60_000,
  });

  const data = query.data;

  const top3 = useMemo(
    () => (data?.channels ?? []).filter((c) => c.contratos + c.receita > 0).slice(0, 3),
    [data],
  );

  const onDrill = (source: ProspectSource, label: string) => {
    dd.open({
      id: `meios-${source}`,
      kind: "contracts",
      title: `${label} — contratos do período`,
      crumb: `Meios · ${label}`,
      params: { source },
    });
  };

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Meios de Prospecção</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Performance por canal · {period.rangeLabel}
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {(data?.channels ?? []).filter((c) => c.leads > 0).length} canais ativos
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading && !data && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando canais…
          </div>
        )}

        {data && (
          <>
            <div className="grid gap-2">
              {data.channels.map((c) => (
                <ChannelRow key={c.source} c={c} onDrill={onDrill} />
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[Trophy, Medal, Award].map((Icon, i) => {
                const c = top3[i];
                const titles = ["Melhor canal", "Segundo melhor", "Terceiro melhor"];
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-border/60 bg-card/40 p-3"
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" /> {titles[i]}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {c ? c.label : "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {c ? `${fmtBRL(c.receita)} · ${c.contratos} contratos` : "Sem dados"}
                    </div>
                  </div>
                );
              })}
            </div>

            {data.worst && data.worst.source !== data.best?.source && (
              <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[hsl(var(--warning))]" />
                <div className="text-xs">
                  <div className="font-medium text-foreground">Canal com menor retorno</div>
                  <div className="text-muted-foreground">
                    {data.worst.label} · {data.worst.leads} ações · {data.worst.contratos} contratos · {data.worst.conversao}% conversão
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">{data.insight}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default MeiosProspeccaoPanel;