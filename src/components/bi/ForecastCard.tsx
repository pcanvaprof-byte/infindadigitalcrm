import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface Props {
  meta: number;
  projecao: number;
  unidade?: string; // "contratos", "R$" etc.
  format?: (n: number) => string;
}

export function ForecastCard({ meta, projecao, unidade = "", format }: Props) {
  const fmt = format ?? ((n: number) => String(Math.round(n)));
  const gap = Math.max(0, meta - projecao);
  const prob = meta > 0 ? Math.max(0, Math.min(100, Math.round((projecao / meta) * 100))) : 0;
  const tone = prob >= 100 ? "text-emerald-400" : prob >= 70 ? "text-amber-400" : "text-rose-400";

  return (
    <Card className="border-primary/15">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" /> Forecast comercial
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Cell label="Meta" value={`${fmt(meta)} ${unidade}`} />
          <Cell label="Projeção" value={`${fmt(projecao)} ${unidade}`} />
          <Cell label="Gap" value={`${fmt(gap)} ${unidade}`} tone={gap > 0 ? "text-rose-400" : "text-emerald-400"} />
          <Cell label="Probabilidade" value={`${prob}%`} tone={tone} />
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700"
            style={{ width: `${prob}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
  );
}