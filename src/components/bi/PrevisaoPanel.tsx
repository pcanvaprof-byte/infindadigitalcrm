import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  recorrencia: number;
  fechado: number;
  pipelineAberto: number;
  /** Probabilidade média do pipeline (0–1). Fallback 0.25 */
  pipelineProbabilidade?: number;
  meta: number;
  /** Label do período ativo (ex: "Este mês", "Hoje"). Default "mês". */
  periodLabel?: string;
  /** Descrição do range (ex: "01/06 → 28/06"). Opcional. */
  rangeLabel?: string;
}

export function PrevisaoPanel({
  recorrencia, fechado, pipelineAberto, pipelineProbabilidade, meta, periodLabel, rangeLabel,
}: Props) {
  const prob = pipelineProbabilidade && pipelineProbabilidade > 0 ? pipelineProbabilidade : 0.25;
  const pipelinePonderado = Math.round(pipelineAberto * prob);
  const projecao = recorrencia + fechado + pipelinePonderado;
  const gap = Math.max(0, meta - projecao);
  const probabilidadeMeta = meta > 0 ? Math.min(100, Math.round((projecao / meta) * 100)) : 0;
  const scope = periodLabel ?? "mês";

  const items = [
    { label: "Recorrência",       value: fmtBRL(recorrencia),       tone: "text-emerald-400" },
    { label: "Receita fechada",   value: fmtBRL(fechado),           tone: "text-primary" },
    { label: "Pipeline aberto",   value: fmtBRL(pipelineAberto),    tone: "text-sky-400" },
    { label: `Projeção (${scope})`, value: fmtBRL(projecao),        tone: "text-foreground" },
    { label: "Gap p/ meta",       value: fmtBRL(gap),               tone: gap > 0 ? "text-rose-400" : "text-emerald-400" },
    { label: "Probabilidade",     value: `${probabilidadeMeta}%`,   tone: probabilidadeMeta >= 100 ? "text-emerald-400" : probabilidadeMeta >= 85 ? "text-amber-400" : "text-rose-400" },
  ];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
          <TrendingUp className="h-3.5 w-3.5" /> Previsão · {scope}
          {rangeLabel ? <span className="ml-1 text-[10px] normal-case tracking-normal text-muted-foreground">({rangeLabel})</span> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Projeção = recorrência + receita fechada + pipeline × {Math.round(prob * 100)}%.
        </p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-xl border border-border bg-card/60 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${it.tone}`}>{it.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}