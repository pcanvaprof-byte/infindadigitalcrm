import { Check, Info } from "lucide-react";
import type { VMROI } from "@/lib/proposta/viewModel";

interface Props {
  roi: VMROI;
  resultados?: string[];
}

const RESULTADOS_DEFAULT = [
  "Fortalecimento da presença digital",
  "Aumento da geração de oportunidades qualificadas",
  "Melhoria na conversão comercial",
  "Processos mais previsíveis e mensuráveis",
  "Integração entre marketing e vendas",
];

export function ROISection({ roi, resultados }: Props) {
  const lista = resultados && resultados.length > 0 ? resultados : RESULTADOS_DEFAULT;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">04 · Resultados esperados</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Resultados esperados do projeto</h2>
        <p className="mt-3 max-w-3xl text-sm md:text-base text-muted-foreground leading-relaxed">
          A operação é estruturada para entregar evolução consistente nos seguintes vetores
          ao longo do projeto:
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {lista.map((r) => (
          <div key={r} className="flex items-start gap-3 rounded-2xl bg-card ring-1 ring-border p-5">
            <Check className="size-5 text-primary-glow mt-0.5 shrink-0" />
            <span className="text-sm text-foreground/90 leading-relaxed">{r}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-card/50 ring-1 ring-border p-5 flex items-start gap-3">
        <Info className="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Os resultados dependem de fatores como investimento em mídia, mercado, concorrência,
          velocidade de implementação e dedicação das equipes envolvidas. Este documento
          apresenta o método de trabalho e não constitui garantia de desempenho.
        </p>
      </div>

      {roi.premissas.length > 0 && (
        <div className="rounded-2xl bg-card/50 ring-1 ring-border p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Premissas consideradas</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {roi.premissas.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}