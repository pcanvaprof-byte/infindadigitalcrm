import { Check } from "lucide-react";

interface Props {
  pontos: string[];
}

export function PorqueInfindaSection({ pontos }: Props) {
  if (pontos.length === 0) return null;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">05 · Sobre a Infinda</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Por que escolher a Infinda</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {pontos.map((p, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl bg-card ring-1 ring-border p-4">
            <div className="grid place-items-center size-8 rounded-lg bg-primary/15 text-primary-glow shrink-0">
              <Check className="size-4" />
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}