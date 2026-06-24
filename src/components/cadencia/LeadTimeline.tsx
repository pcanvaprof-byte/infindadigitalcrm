import { useQuery } from "@tanstack/react-query";
import { listMessages } from "@/lib/cadencia/api";
import type { CadMessage } from "@/lib/cadencia/types";
import { CAD_STAGE_LABEL } from "@/lib/cadencia/types";
import { ArrowDown, ArrowUp, Settings } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function LeadTimeline({ leadId }: { leadId: string }) {
  const q = useQuery({ queryKey: ["cad-messages", leadId], queryFn: () => listMessages(leadId) });
  const items = (q.data ?? []) as CadMessage[];
  if (q.isLoading) return <div className="text-sm text-muted-foreground">Carregando histórico...</div>;
  if (items.length === 0) return <div className="text-sm text-muted-foreground">Sem registros ainda.</div>;
  return (
    <ul className="space-y-2">
      {items.map((m) => {
        const Icon = m.direction === "in" ? ArrowDown : m.direction === "system" ? Settings : ArrowUp;
        return (
          <li key={m.id} className="rounded-md border border-border bg-card p-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3 w-3" />
              <span className="uppercase tracking-wide">{m.tipo}</span>
              {m.stage_at_send && <span>· {CAD_STAGE_LABEL[m.stage_at_send]}</span>}
              <span className="ml-auto">{fmt(m.created_at)}</span>
            </div>
            {m.mensagem && <div className="mt-1 text-sm whitespace-pre-wrap">{m.mensagem}</div>}
          </li>
        );
      })}
    </ul>
  );
}