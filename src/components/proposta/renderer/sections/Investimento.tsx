import { CalendarClock, FileBarChart, Megaphone, ScrollText } from "lucide-react";
import { brl, type VMCrescimento, type VMInvestimento, type VMItem } from "@/lib/proposta/viewModel";

interface Props {
  investimento: VMInvestimento;
  crescimento?: VMCrescimento | null;
  itens?: VMItem[];
}

export function InvestimentoSection({ investimento, itens }: Props) {
  const hasMensal = investimento.mensal > 0;
  const hasImpl = investimento.implantacao > 0;
  const hasAvulso = investimento.avulso > 0;

  const hasTrafego = (itens ?? []).some((it) => {
    const hay = `${it.nome} ${it.categoria ?? ""} ${it.descricao ?? ""}`.toLowerCase();
    return /tr[aá]fego|ads|gerenciador|m[ií]dia paga|google ads|meta ads/.test(hay);
  });

  return (
    <section className="space-y-6" id="investimento">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">08 · Investimento</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Investimento</h2>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-primary/25 via-card to-card ring-1 ring-primary/40 p-6 md:p-8 shadow-2xl shadow-primary/10">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] items-end">
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
          <div className="mt-6 pt-6 border-t border-border/50">
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

      <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/30 p-6 flex items-start gap-4">
        <CalendarClock className="size-6 text-primary-glow shrink-0 mt-0.5" />
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary-glow font-semibold">
            Vigência contratual
          </div>
          <p className="text-base md:text-lg font-semibold text-foreground">
            Contrato mínimo de 3 meses.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Os primeiros meses são destinados à estruturação, coleta de dados, otimização e
            validação das estratégias. Este período é essencial para gerar informações
            consistentes que permitam a evolução contínua da operação. Após o período mínimo,
            o contrato passa à renovação mensal, podendo ser encerrado mediante aviso
            contratual.
          </p>
        </div>
      </div>

      {hasTrafego && (
        <div className="rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30 p-5 flex items-start gap-3">
          <Megaphone className="size-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <strong className="text-foreground">Investimento mínimo em mídia paga: R$ 1.000,00/mês.</strong>{" "}
            <span className="text-muted-foreground">
              O investimento em mídia paga é realizado diretamente nas plataformas
              (Google Ads e Meta Ads) e não está incluso na mensalidade de gestão acima.
              Este patamar mínimo é necessário para gerar volume estatístico suficiente
              para otimização das campanhas.
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <TrustCard
          icon={<ScrollText className="size-5" />}
          title="Contrato mínimo de 3 meses"
          text="Após esse período, renovação mensal podendo ser encerrado mediante aviso contratual."
        />
        <TrustCard
          icon={<FileBarChart className="size-5" />}
          title="Governança por indicadores"
          text="Acompanhamento periódico com indicadores comerciais e revisão estratégica."
        />
        <TrustCard
          icon={<FileBarChart className="size-5" />}
          title="Transparência total"
          text="Acesso aos relatórios, dashboards e dados gerados pela operação."
        />
      </div>
    </section>
  );
}

function TrustCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-5">
      <div className="flex items-center gap-2 text-primary-glow">
        {icon}
        <span className="text-xs uppercase tracking-wider font-semibold">{title}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}