import { FileText, Download } from "lucide-react";
import type { VMAnexo } from "@/lib/proposta/viewModel";

interface Props { anexos: VMAnexo[] }

export function AnexosSection({ anexos }: Props) {
  if (anexos.length === 0) return null;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">10 · Documentos</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Anexos e complementos</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {anexos.map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl bg-card ring-1 ring-border p-4 hover:ring-primary/40 transition"
          >
            <div className="grid place-items-center size-10 rounded-lg bg-primary/15 text-primary-glow"><FileText className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">{a.nome}</div>
              {a.tamanho && <div className="text-xs text-muted-foreground">{Math.round(a.tamanho / 1024)} KB</div>}
            </div>
            <Download className="size-4 text-muted-foreground" />
          </a>
        ))}
      </div>
    </section>
  );
}