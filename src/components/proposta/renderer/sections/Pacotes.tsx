import { Check, Star } from "lucide-react";
import { brl, type VMPacote } from "@/lib/proposta/viewModel";

interface Props {
  pacotes: VMPacote[];
}

export function PacotesSection({ pacotes }: Props) {
  if (pacotes.length === 0) return null;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">Opções</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Compare os pacotes</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {pacotes.map((p) => (
          <div
            key={p.id}
            className={
              p.recomendado
                ? "relative rounded-2xl bg-gradient-to-br from-primary/20 to-card ring-2 ring-primary p-6 shadow-xl shadow-primary/20"
                : "rounded-2xl bg-card ring-1 ring-border p-6"
            }
          >
            {p.recomendado && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                <Star className="size-3 fill-current" />
                Recomendado
              </div>
            )}
            <h3 className="text-xl font-bold">{p.nome}</h3>
            <div className="mt-4 space-y-1">
              {p.totalImplantacao > 0 && <div className="text-sm text-muted-foreground">Implantação: <span className="text-foreground font-semibold">{brl(p.totalImplantacao)}</span></div>}
              {p.totalMensal > 0 && <div className="text-sm text-muted-foreground">Mensal: <span className="text-foreground font-semibold">{brl(p.totalMensal)}/mês</span></div>}
              {p.totalAvulso > 0 && <div className="text-sm text-muted-foreground">Avulso: <span className="text-foreground font-semibold">{brl(p.totalAvulso)}</span></div>}
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {p.itens.map((i) => (
                <li key={i.id} className="flex gap-2 text-foreground/90">
                  <Check className="size-4 text-success mt-0.5 shrink-0" />
                  <span>{i.nome}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}