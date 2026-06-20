import { AlertCircle, TrendingDown } from "lucide-react";
import type { VMDiagnostico, VMHeader } from "@/lib/proposta/viewModel";

interface Props {
  diagnostico: VMDiagnostico;
  header: VMHeader;
}

export function DiagnosticoSection({ diagnostico, header }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">01 · Diagnóstico</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          O cenário de {header.cliente.nome}
        </h2>
      </div>
      <p className="text-lg leading-relaxed text-muted-foreground max-w-3xl">{diagnostico.texto}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-card ring-1 ring-border p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5" />
            <h3 className="font-semibold">Riscos atuais</h3>
          </div>
          <ul className="mt-4 space-y-2">
            {diagnostico.riscosAtuais.map((r, i) => (
              <li key={i} className="text-sm text-foreground/90 flex gap-2">
                <span className="text-destructive mt-1">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-card ring-1 ring-border p-6">
          <div className="flex items-center gap-2 text-warning">
            <TrendingDown className="size-5" />
            <h3 className="font-semibold">Oportunidades perdidas hoje</h3>
          </div>
          <ul className="mt-4 space-y-2">
            {diagnostico.oportunidadesPerdidas.map((o, i) => (
              <li key={i} className="text-sm text-foreground/90 flex gap-2">
                <span className="text-warning mt-1">•</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}