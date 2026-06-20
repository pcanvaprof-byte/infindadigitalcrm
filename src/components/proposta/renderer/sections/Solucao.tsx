import { Check, Sparkles } from "lucide-react";
import type { VMSolucao } from "@/lib/proposta/viewModel";

interface Props {
  solucao: VMSolucao;
}

export function SolucaoSection({ solucao }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">02 · Nossa solução</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          Como vamos resolver
        </h2>
      </div>
      <p className="text-lg leading-relaxed text-muted-foreground max-w-3xl">{solucao.solucao}</p>

      {solucao.problemas.length > 0 && (
        <div className="rounded-2xl bg-card/50 ring-1 ring-border p-6">
          <h3 className="font-semibold text-foreground">Problemas que estamos endereçando</h3>
          <ul className="mt-3 space-y-2">
            {solucao.problemas.map((p, i) => (
              <li key={i} className="text-sm text-foreground/90 flex gap-2">
                <span className="text-primary-glow mt-1">→</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-card ring-1 ring-primary/30 p-6">
          <div className="flex items-center gap-2 text-primary-glow">
            <Sparkles className="size-5" />
            <h3 className="font-semibold">Diferenciais competitivos</h3>
          </div>
          <ul className="mt-4 space-y-2">
            {solucao.diferenciaisCompetitivos.map((d, i) => (
              <li key={i} className="text-sm text-foreground/90 flex gap-2">
                <Check className="size-4 text-primary-glow mt-0.5 shrink-0" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-card ring-1 ring-border p-6">
          <h3 className="font-semibold text-foreground">Ganhos esperados</h3>
          <ul className="mt-4 space-y-2">
            {solucao.ganhosEsperados.map((g, i) => (
              <li key={i} className="text-sm text-foreground/90 flex gap-2">
                <Check className="size-4 text-success mt-0.5 shrink-0" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}