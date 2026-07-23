import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DemoCountdown({ expiresAt }: { expiresAt: string }) {
  const target = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target - now;
  const expired = remaining <= 0;
  const critical = remaining <= 10 * 60 * 1000;

  const tone = expired
    ? "border-destructive/60 bg-destructive/15 text-destructive"
    : critical
      ? "border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200"
      : "border-primary/40 bg-primary/10 text-primary";

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs font-medium ${tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Demo gratuita
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
  );
}