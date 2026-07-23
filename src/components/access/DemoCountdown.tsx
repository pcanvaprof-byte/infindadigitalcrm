import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MessageCircle } from "lucide-react";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DemoCountdown({
  expiresAt,
  label = "Demo gratuita",
}: {
  expiresAt: string;
  label?: string;
}) {
  const target = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target - now;
  const expired = remaining <= 0;
  const critical = remaining <= 10 * 60 * 1000;
  const warnOpen = critical && !dismissed;

  const minutesLeft = Math.max(0, Math.ceil(remaining / 60000));
  const alertTitle = expired
    ? "Sua demo expirou"
    : minutesLeft <= 1
      ? "Sua demo expira em menos de 1 minuto"
      : `Sua demo expira em ${minutesLeft} minutos`;
  const alertBody = expired
    ? "O acesso de demonstração foi encerrado. Fale com o time comercial para ativar sua conta e continuar exatamente de onde parou."
    : `Você tem ${formatRemaining(remaining)} restantes. Fale agora com o comercial para ativar sua conta antes que o acesso seja bloqueado — todos os dados criados permanecem.`;

  const whatsappUrl =
    "https://wa.me/5541999999999?text=" +
    encodeURIComponent("Olá! Estou testando a demo da Infinda e quero ativar minha conta.");

  const tone = expired
    ? "border-destructive/60 bg-destructive/15 text-destructive"
    : critical
      ? "border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200"
      : "border-primary/40 bg-primary/10 text-primary";

  return (
    <>
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs font-medium ${tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="tabular-nums">
        {expired ? "Tempo esgotado" : `Tempo restante: ${formatRemaining(remaining)}`}
      </span>
      <Link
        to="/assinatura"
        className="underline underline-offset-2 hover:opacity-80"
      >
        Ativar por R$ 200/mês
      </Link>
    </div>

    <Dialog open={warnOpen} onOpenChange={(o) => { if (!o) setDismissed(true); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {alertTitle}
          </DialogTitle>
          <DialogDescription>{alertBody}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">Tempo restante</p>
          <p className="text-2xl font-semibold tabular-nums">
            {expired ? "00:00:00" : formatRemaining(remaining)}
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              Falar com o comercial
            </a>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/assinatura">Ativar agora</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}