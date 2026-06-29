import type { ReactNode } from "react";
import { useAutoSyncContratos } from "../hooks/useAutoSyncContratos";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

function formatRelative(ts: number): string {
  if (!ts) return "ainda não sincronizado";
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(ts).toLocaleString("pt-BR");
}

export function OperacoesLayout({
  description,
  children,
}: {
  description?: string;
  children: ReactNode;
}) {
  const { lastSync, syncing, runNow } = useAutoSyncContratos();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Contratos: {formatRelative(lastSync)}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => void runNow()}
            disabled={syncing}
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}