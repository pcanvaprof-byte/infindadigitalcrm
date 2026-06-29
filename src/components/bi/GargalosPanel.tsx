import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, CheckCircle2 } from "lucide-react";

interface Item {
  /** Identificador curto, ex: "Visitas" */
  label: string;
  /** Valor realizado */
  value: number;
  /** Meta correspondente */
  goal: number;
  /** Texto curto opcional (ex: "hoje", "semana") */
  scope?: string;
  /** Callback opcional ao clicar no item (drill-down). */
  onDrillDown?: () => void;
}

interface Props {
  items: Item[];
  /** Máximo de gargalos a mostrar (default 5) */
  max?: number;
}

function pct(value: number, goal: number) {
  if (!goal || goal <= 0) return 0;
  return Math.round((value / goal) * 100);
}

/**
 * Lista os piores gargalos: ordenado pelo % vs meta.
 * Sem IA, apenas regras: <70% crítico, <90% atenção, ≥100% ok.
 */
export function GargalosPanel({ items, max = 5 }: Props) {
  const ranked = [...items]
    .map((it) => ({ ...it, p: pct(it.value, it.goal) }))
    .sort((a, b) => a.p - b.p)
    .slice(0, max);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-400/90">
          <AlertTriangle className="h-3.5 w-3.5" /> Gargalos do dia
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          O que está mais distante da meta agora — atacar primeiro.
        </p>

        <div className="mt-4 space-y-2.5">
          {ranked.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem dados suficientes para apontar gargalos.</p>
          )}
          {ranked.map((it) => {
            const tone =
              it.p >= 100 ? "text-emerald-400"
              : it.p >= 90 ? "text-amber-400"
              : it.p >= 70 ? "text-amber-500"
              : "text-rose-400";
            const Icon = it.p >= 100 ? CheckCircle2 : TrendingDown;
            const barTone =
              it.p >= 100 ? "bg-emerald-500/70"
              : it.p >= 90 ? "bg-amber-400/70"
              : it.p >= 70 ? "bg-amber-500/70"
              : "bg-rose-500/70";
            const width = Math.min(100, Math.max(2, it.p));
            const clickable = !!it.onDrillDown;
            return (
              <div
                key={it.label}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? it.onDrillDown : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          it.onDrillDown?.();
                        }
                      }
                    : undefined
                }
                className={`rounded-lg border bg-card/60 p-3 transition ${
                  clickable ? "border-border hover:border-primary/50 hover:bg-accent/20 cursor-pointer" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className={`h-4 w-4 ${tone}`} />
                    <span className="font-medium">{it.label}</span>
                    {it.scope && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.scope}</span>
                    )}
                  </div>
                  <span className={`text-sm tabular-nums ${tone}`}>
                    {it.value}/{it.goal} · {it.p}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                  <div className={`h-full ${barTone} transition-all`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}