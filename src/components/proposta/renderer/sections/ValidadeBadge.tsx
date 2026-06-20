import { Clock, AlertTriangle } from "lucide-react";
import type { VMHeader } from "@/lib/proposta/viewModel";

interface Props {
  header: VMHeader;
}

export function ValidadeBadge({ header }: Props) {
  if (!header.validadeAte) return null;
  const dias = header.diasRestantes;
  const expirada = header.expirada;
  const urgente = !expirada && dias !== null && dias <= 3;
  const dataFmt = new Date(header.validadeAte).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const tone = expirada
    ? "bg-destructive/15 text-destructive ring-destructive/30"
    : urgente
      ? "bg-warning/15 text-warning ring-warning/30"
      : "bg-card text-muted-foreground ring-border";

  const label = expirada
    ? "Proposta expirada"
    : dias === null
      ? `Válida até ${dataFmt}`
      : dias === 0
        ? "Expira hoje"
        : dias === 1
          ? "Expira amanhã"
          : `Válida por mais ${dias} dias · até ${dataFmt}`;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ${tone}`}>
      {expirada ? <AlertTriangle className="size-4" /> : <Clock className="size-4" />}
      {label}
    </div>
  );
}