import { Sparkles, Check } from "lucide-react";
import type { VMCrescimento, VMHeader, VMROI } from "@/lib/proposta/viewModel";

interface Props {
  header: VMHeader;
  crescimento?: VMCrescimento | null;
  roi?: VMROI;
}

export function HeroSection({ header }: Props) {
  const pilares = [
    "Estratégia comercial estruturada",
    "Tecnologia, CRM e automação",
    "Marketing orientado por indicadores",
    "Governança contínua e mensuração",
  ];
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-card to-card p-6 md:p-10 ring-1 ring-primary/20 shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--color-primary-glow)_0%,_transparent_55%)] opacity-30" aria-hidden />
      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">
            <Sparkles className="size-3.5" />
            Proposta comercial · {header.numero}
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl xl:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
            Crescimento estruturado através de <span className="text-primary-glow">estratégia, tecnologia e execução</span>.
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
            Esta proposta apresenta nossa visão para estruturar uma operação comercial mais
            eficiente e previsível, utilizando tecnologia, marketing e processos orientados
            por indicadores.
          </p>
          <p className="mt-6 text-sm md:text-base">
            Preparada para <span className="text-foreground font-semibold">{header.cliente.nome}</span>
            {header.cliente.contato ? <span className="text-muted-foreground"> · {header.cliente.contato}</span> : null}
          </p>
          {(header.cliente.segmento || header.cliente.cidade) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[header.cliente.segmento, header.cliente.cidade].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-background/40 ring-1 ring-primary/30 p-6 md:p-7 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary-glow font-semibold">
            Pilares deste projeto
          </div>
          <p className="mt-2 text-lg md:text-xl font-semibold leading-snug text-foreground">
            Construção de uma operação comercial digital integrada e mensurável.
          </p>
          <ul className="mt-5 space-y-2.5">
            {pilares.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-foreground/90">
                <Check className="size-4 text-primary-glow mt-0.5 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground/80">
            Documento comercial preparado para apresentação executiva. O conteúdo descreve
            método, escopo e governança — não constitui promessa de resultado.
          </p>
        </div>
      </div>
    </section>
  );
}