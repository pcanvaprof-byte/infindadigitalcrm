import { Sparkles } from "lucide-react";
import type { VMHeader } from "@/lib/proposta/viewModel";

interface Props {
  header: VMHeader;
}

export function HeroSection({ header }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-card to-card p-8 md:p-12 ring-1 ring-primary/20 shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--color-primary-glow)_0%,_transparent_50%)] opacity-30" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">
          <Sparkles className="size-3.5" />
          Proposta comercial · {header.numero}
        </div>
        <h1 className="mt-4 text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
          {header.titulo}
        </h1>
        <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl">
          Preparada para <span className="text-foreground font-semibold">{header.cliente.nome}</span>
          {header.cliente.contato ? ` · ${header.cliente.contato}` : ""}
        </p>
        {(header.cliente.segmento || header.cliente.cidade) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[header.cliente.segmento, header.cliente.cidade].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}