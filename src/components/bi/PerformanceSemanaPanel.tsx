import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "lucide-react";
import { fetchWeekMetrics, fetchRangeMetrics, type WeekMetrics } from "@/lib/bi/today";
import type { ResolvedPeriod } from "@/lib/bi/period";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Goals = {
  receita: number;
  contratos: number;
  empresas: number;
  disparos: number;
  novosContatos: number;
  videos: number;
  parcerias: number;
};

export const DEFAULT_WEEK_GOALS: Goals = {
  receita: 17000,
  contratos: 4,
  empresas: 180,
  disparos: 240,
  novosContatos: 50,
  videos: 2,
  parcerias: 1,
};

function tone(pct: number) {
  if (pct >= 100) return { bar: "bg-emerald-500", text: "text-emerald-400", label: "no ritmo" };
  if (pct >= 70)  return { bar: "bg-amber-500",   text: "text-amber-400",   label: "atenção" };
  return            { bar: "bg-rose-500",    text: "text-rose-400",    label: "crítico" };
}

function Row({
  label, done, goal, formatter,
}: { label: string; done: number; goal: number; formatter?: (n: number) => string }) {
  const pct = goal > 0 ? Math.round((done / goal) * 100) : 0;
  const t = tone(pct);
  const fmt = formatter ?? ((n: number) => String(n));
  const falta = Math.max(0, goal - done);
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wider">{label}</span>
        <Badge variant="secondary" className={t.text}>{pct}%</Badge>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">{fmt(done)}</span>
        <span className="text-[11px] text-muted-foreground">/ {fmt(goal)}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div className={`h-full ${t.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {falta > 0 ? <>Faltam <strong className="text-foreground">{fmt(falta)}</strong></> : "Meta da semana batida"}
      </p>
    </div>
  );
}

export function PerformanceSemanaPanel({
  goals = DEFAULT_WEEK_GOALS,
  period,
}: { goals?: Goals; period?: ResolvedPeriod }) {
  const usingRange = !!period && period.key !== "semana";
  const q = useQuery<WeekMetrics>({
    queryKey: ["bi", "perf", period?.key ?? "semana", period?.from?.toDateString(), period?.to?.toDateString()],
    queryFn: () =>
      usingRange && period ? fetchRangeMetrics(period.from, period.to) : fetchWeekMetrics(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  // Escala as metas semanais para o período visualizado.
  const scale = usingRange && period ? Math.max(0.1, period.days / 7) : 1;
  const g: Goals = {
    receita: Math.round(goals.receita * scale),
    contratos: Math.max(1, Math.round(goals.contratos * scale)),
    empresas: Math.max(1, Math.round(goals.empresas * scale)),
    disparos: Math.max(1, Math.round(goals.disparos * scale)),
    novosContatos: Math.max(1, Math.round(goals.novosContatos * scale)),
    videos: Math.max(1, Math.round(goals.videos * scale)),
    parcerias: Math.max(1, Math.round(goals.parcerias * scale)),
  };
  const d = q.data ?? {
    receita: 0, disparos: 0, contatos: 0,
    contratos: 0, empresasTrabalhadas: 0, novosContatos: 0, videos: 0, parcerias: 0,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" /> Performance — {period?.label ?? "Semana"}
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
            {q.isFetching ? "atualizando…" : usingRange ? "metas escaladas" : "metas semanais"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Row label="Receita"            done={d.receita}             goal={g.receita}       formatter={fmtBRL} />
        <Row label="Contratos"          done={d.contratos}           goal={g.contratos} />
        <Row label="Empresas trabalhadas" done={d.empresasTrabalhadas} goal={g.empresas} />
        <Row label="Disparos"           done={d.disparos}            goal={g.disparos} />
        <Row label="Novos contatos"     done={d.novosContatos}       goal={g.novosContatos} />
        <Row label="Vídeos"             done={d.videos}              goal={g.videos} />
        <Row label="Parcerias"          done={d.parcerias}           goal={g.parcerias} />
      </CardContent>
    </Card>
  );
}