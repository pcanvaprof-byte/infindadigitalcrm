interface Props { passos: string[] }

export function ProximosPassosSection({ passos }: Props) {
  if (passos.length === 0) return null;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">09 · Próximos passos</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Próximos passos</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {passos.map((p, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl bg-card ring-1 ring-border p-4">
            <div className="grid place-items-center size-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">{i + 1}</div>
            <p className="text-sm text-foreground/90 pt-0.5">{p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}