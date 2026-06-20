import { TrendingUp, Sparkles, Target } from "lucide-react";
import { brl, type VMCrescimento, type VMCrescimentoCenario } from "@/lib/proposta/viewModel";

interface Props {
  crescimento: VMCrescimento;
}

export function CrescimentoSection({ crescimento }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">05 · Projeção</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          📈 Seu potencial de crescimento com este investimento
        </h2>
        <p className="mt-3 max-w-3xl text-sm md:text-base text-muted-foreground leading-relaxed">
          O resultado varia por nicho. Esta projeção é baseada em comportamento médio de mercado de empresas
          semelhantes em <strong className="text-foreground">{crescimento.nicho}</strong>
          {crescimento.tipoNegocio ? ` (${crescimento.tipoNegocio})` : ""} — não é uma promessa, é o cenário
          esperado pelo investimento e maturidade atuais.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {crescimento.cenarios.map((c) => (
          <CenarioCard key={c.nome} cenario={c} />
        ))}
      </div>

      {crescimento.premissas.length > 0 && (
        <div className="rounded-2xl bg-card/50 ring-1 ring-border p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Premissas consideradas
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {crescimento.premissas.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 text-primary-glow">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/30 p-6">
        <div className="flex items-start gap-3">
          <Target className="size-5 text-primary-glow mt-0.5 shrink-0" />
          <p className="text-sm md:text-base leading-relaxed text-foreground/90">
            {crescimento.fechamento}
          </p>
        </div>
      </div>
    </section>
  );
}

function CenarioCard({ cenario }: { cenario: VMCrescimentoCenario }) {
  const highlight = cenario.nome === "Esperado";
  return (
    <div
      className={
        highlight
          ? "rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 ring-1 ring-primary/40 p-6 shadow-lg shadow-primary/10"
          : "rounded-2xl bg-card ring-1 ring-border p-6"
      }
    >
      <div className="flex items-center gap-2 text-primary-glow">
        {highlight ? <Sparkles className="size-4" /> : <TrendingUp className="size-4" />}
        <span className="text-xs uppercase tracking-wider font-semibold">Cenário {cenario.nome}</span>
      </div>

      <div className="mt-5 space-y-4">
        <Block
          label="Em 90 dias"
          valor={cenario.faturamento90}
          roi={cenario.roi90}
          clientes={cenario.novosClientes90}
        />
        <div className="h-px bg-border/60" />
        <Block
          label="Em 180 dias"
          valor={cenario.faturamento180}
          roi={cenario.roi180}
          clientes={cenario.novosClientes180}
          big
        />
      </div>

      <p className="mt-5 text-xs text-muted-foreground leading-relaxed">{cenario.justificativa}</p>
    </div>
  );
}

function Block({
  label,
  valor,
  roi,
  clientes,
  big,
}: {
  label: string;
  valor: number;
  roi: number;
  clientes: number;
  big?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</div>
      <div className={big ? "mt-1 text-2xl md:text-3xl font-bold tracking-tight" : "mt-1 text-xl font-bold tracking-tight"}>
        {brl(valor)}
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          ROI <strong className="text-foreground">{roi.toFixed(1)}x</strong>
        </span>
        {clientes > 0 && (
          <span>
            ~<strong className="text-foreground">{clientes}</strong> novos clientes
          </span>
        )}
      </div>
    </div>
  );
}