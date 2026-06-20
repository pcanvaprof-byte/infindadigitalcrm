import { brl, type VMItem } from "@/lib/proposta/viewModel";
import { Check, Minus } from "lucide-react";

interface Props {
  itens: VMItem[];
  canDecide: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}

const COBRANCA_LABEL: Record<VMItem["cobranca"], string> = {
  implantacao: "Implantação",
  mensal: "Mensal",
  avulso: "Avulso",
};

export function ItensSection({ itens, canDecide, onAccept, onReject }: Props) {
  if (itens.length === 0) return null;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">Escopo</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">O que está incluso</h2>
      </div>
      <div className="space-y-3">
        {itens.map((item) => (
          <div
            key={item.id}
            className={
              item.decisao === "recusado"
                ? "rounded-2xl bg-card/50 ring-1 ring-border p-5 opacity-60"
                : item.decisao === "aceito"
                  ? "rounded-2xl bg-card ring-1 ring-success/40 p-5"
                  : "rounded-2xl bg-card ring-1 ring-border p-5"
            }
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{item.nome}</h3>
                  <span className="inline-flex items-center rounded-full bg-primary/15 text-primary-glow px-2 py-0.5 text-xs font-medium">
                    {COBRANCA_LABEL[item.cobranca]}
                  </span>
                  {item.decisao === "aceito" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-xs font-medium">
                      <Check className="size-3" /> Aceito
                    </span>
                  )}
                  {item.decisao === "recusado" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                      <Minus className="size-3" /> Recusado
                    </span>
                  )}
                </div>
                {item.descricao && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.descricao}</p>
                )}
                {item.entregaveis.length > 0 && (
                  <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {item.entregaveis.map((e, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-primary-glow">·</span>
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-foreground">{brl(item.valorTotal)}</div>
                {item.cobranca === "mensal" && <div className="text-xs text-muted-foreground">/mês</div>}
              </div>
            </div>
            {canDecide && (
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => onReject?.(item.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-border text-muted-foreground hover:text-foreground hover:ring-foreground/30 transition"
                >
                  Remover
                </button>
                <button
                  type="button"
                  onClick={() => onAccept?.(item.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium bg-primary/15 text-primary-glow ring-1 ring-primary/30 hover:bg-primary/25 transition"
                >
                  Manter
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}