import { Quote } from "lucide-react";
import type { VMCase } from "@/lib/proposta/viewModel";

interface Props {
  cases: VMCase[];
}

export function CasesSection({ cases }: Props) {
  if (cases.length === 0) return null;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">06 · Provas sociais</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Cases que já entregamos</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cases.map((c, i) => (
          <article key={i} className="rounded-2xl bg-card ring-1 ring-border p-6">
            <Quote className="size-6 text-primary-glow opacity-60" />
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {c.segmento ?? "Confidencial"}
              </div>
              <h3 className="mt-1 font-semibold text-foreground">{c.cliente}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground"><strong className="text-foreground/80">Desafio:</strong> {c.desafio}</p>
            <p className="mt-2 text-sm text-success font-medium">→ {c.resultado}</p>
          </article>
        ))}
      </div>
    </section>
  );
}