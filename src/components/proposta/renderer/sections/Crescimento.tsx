import { Compass, Info } from "lucide-react";
import type { VMCrescimento } from "@/lib/proposta/viewModel";

interface Props {
  crescimento: VMCrescimento;
}

const FASES = [
  {
    periodo: "30 dias",
    titulo: "Estruturação",
    entregas: [
      "Implantação inicial dos sistemas e processos",
      "Configuração de canais, CRM e mensuração",
      "Definição de indicadores e linha de base",
    ],
  },
  {
    periodo: "60 dias",
    titulo: "Otimização",
    entregas: [
      "Refinamento das campanhas e mensagens",
      "Ajustes de funil e cadência comercial",
      "Primeiros aprendizados consolidados",
    ],
  },
  {
    periodo: "90 dias",
    titulo: "Consolidação",
    entregas: [
      "Processos mais maduros e replicáveis",
      "Melhoria contínua orientada por dados",
      "Decisões comerciais baseadas em indicadores",
    ],
  },
  {
    periodo: "180 dias",
    titulo: "Escala",
    entregas: [
      "Expansão de canais e oportunidades",
      "Identificação de novas frentes de crescimento",
      "Operação sustentável e previsível",
    ],
  },
];

export function CrescimentoSection({ crescimento }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">05 · Evolução</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          Evolução esperada do projeto
        </h2>
        <p className="mt-3 max-w-3xl text-sm md:text-base text-muted-foreground leading-relaxed">
          O projeto segue uma curva de maturação orientada por etapas. Cada fase tem
          entregas e indicadores específicos, com o objetivo de consolidar uma operação
          comercial digital sustentável.
        </p>
      </div>

      <ol className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {FASES.map((f, i) => (
          <li
            key={f.periodo}
            className="rounded-2xl bg-card ring-1 ring-border p-6 relative"
          >
            <div className="flex items-center gap-2 text-primary-glow">
              <Compass className="size-4" />
              <span className="text-xs uppercase tracking-wider font-semibold">
                Fase {i + 1} · {f.periodo}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{f.titulo}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {f.entregas.map((e) => (
                <li key={e} className="flex gap-2">
                  <span className="mt-1 text-primary-glow">·</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl bg-card/50 ring-1 ring-border p-5 flex items-start gap-3">
        <Info className="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          O desempenho evolui conforme histórico de campanhas, maturidade digital,
          investimento em mídia e participação do cliente no processo. Os primeiros 30 dias
          são dedicados à estruturação e mensuração; o crescimento é progressivo e
          cumulativo ao longo do contrato.
        </p>
      </div>
    </section>
  );
}