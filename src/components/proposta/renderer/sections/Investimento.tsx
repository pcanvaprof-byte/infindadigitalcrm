import { brl, type VMInvestimento } from "@/lib/proposta/viewModel";

interface Props {
  investimento: VMInvestimento;
}

export function InvestimentoSection({ investimento }: Props) {
  const hasMensal = investimento.mensal > 0;
  const hasImpl = investimento.implantacao > 0;
  const hasAvulso = investimento.avulso > 0;

  return (
    <section className="space-y-6" id="investimento">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">08 · Investimento</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Seu investimento</h2>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-primary/25 via-card to-card ring-1 ring-primary/40 p-8 md:p-10 shadow-2xl shadow-primary/10">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] items-end">
          <div className="space-y-4">
            {hasImpl && (
              <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Investimento de implantação</span>
                <span className="text-xl font-semibold">{brl(investimento.implantacao)}</span>
              </div>
            )}
            {hasMensal && (
              <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Mensalidade recorrente</span>
                <span className="text-xl font-semibold">{brl(investimento.mensal)}<span className="text-sm text-muted-foreground"> /mês</span></span>
              </div>
            )}
            {hasAvulso && (
              <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Avulsos</span>
                <span className="text-xl font-semibold">{brl(investimento.avulso)}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total em 12 meses</div>
            <div className="mt-1 text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              {brl(investimento.total12m)}
            </div>
          </div>
        </div>

        {investimento.parcelasSugeridas.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border/50">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Parcelamento sugerido</div>
            <div className="mt-3 flex flex-wrap gap-3">
              {investimento.parcelasSugeridas.map((p) => (
                <div key={p.vezes} className="rounded-xl bg-background/40 ring-1 ring-border px-4 py-3 text-sm">
                  <span className="font-bold text-primary-glow">{p.vezes}x</span>{" "}
                  <span className="text-foreground">{brl(p.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}