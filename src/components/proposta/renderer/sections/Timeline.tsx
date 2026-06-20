import type { VMTimelineEntrega } from "@/lib/proposta/viewModel";

interface Props {
  timeline: VMTimelineEntrega[];
}

export function TimelineSection({ timeline }: Props) {
  if (timeline.length === 0) return null;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">07 · Cronograma</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Próximos passos</h2>
      </div>
      <ol className="relative space-y-6 border-l border-border pl-8">
        {timeline.map((t, i) => (
          <li key={i} className="relative">
            <div className="absolute -left-[37px] grid place-items-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold ring-4 ring-background">
              {i + 1}
            </div>
            <div className="rounded-2xl bg-card ring-1 ring-border p-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-xs uppercase tracking-wider text-primary-glow font-semibold">{t.semana}</span>
                <h3 className="text-lg font-semibold text-foreground">{t.titulo}</h3>
              </div>
              {t.entregas.length > 0 && (
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {t.entregas.map((e, j) => (
                    <li key={j} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary-glow">·</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}