import { Clock } from "lucide-react";

export function TrialBanner({ daysRemaining }: { daysRemaining: number }) {
  if (daysRemaining > 7) return null;

  const tone =
    daysRemaining <= 1
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : daysRemaining <= 3
        ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border bg-muted/60 text-muted-foreground";

  const label =
    daysRemaining <= 0
      ? "Seu acesso expira hoje."
      : daysRemaining === 1
        ? "Seu acesso expira em 1 dia."
        : `Seu acesso expira em ${daysRemaining} dias.`;

  return (
    <div className={`flex items-center gap-2 border-b px-4 py-2 text-xs ${tone}`} role="status">
      <Clock className="h-3.5 w-3.5" />
      <span>{label} Renove sua assinatura para continuar utilizando a plataforma.</span>
    </div>
  );
}