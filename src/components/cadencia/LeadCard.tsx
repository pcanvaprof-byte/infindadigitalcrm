import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { diasSemResposta, type CadLead } from "@/lib/cadencia/types";
import { TemperaturaBadge } from "./TemperaturaBadge";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function LeadCard({
  lead,
  onOpen,
  onSend,
}: {
  lead: CadLead;
  onOpen: () => void;
  onSend: () => void;
}) {
  const dias = diasSemResposta(lead);
  const overdue =
    lead.next_action_at && new Date(lead.next_action_at).getTime() < Date.now();
  return (
    <Card className="p-3 bg-card border-border hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="flex-1 text-left">
          <div className="font-semibold text-sm text-foreground truncate">{lead.empresa}</div>
          {lead.responsavel && (
            <div className="text-xs text-muted-foreground truncate">
              {lead.responsavel}{lead.cargo ? ` · ${lead.cargo}` : ""}
            </div>
          )}
        </button>
        <TemperaturaBadge temp={lead.temperatura} />
      </div>
      {lead.telefone && (
        <div className="mt-1 text-[11px] text-muted-foreground">{lead.telefone}</div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
        <div>1ª abord.: <span className="text-foreground">{fmt(lead.primeira_abordagem_at)}</span></div>
        <div>Último: <span className="text-foreground">{fmt(lead.last_contact_at)}</span></div>
        <div>Próx.: <span className={overdue ? "text-rose-400 font-medium" : "text-foreground"}>{fmt(lead.next_action_at)}</span></div>
        <div>Sem resp.: <span className="text-foreground">{dias}d</span></div>
      </div>
      <Button size="sm" variant="secondary" className="mt-2 w-full h-7 text-xs" onClick={onSend}>
        <Send className="h-3 w-3 mr-1" /> Enviar Mensagem
      </Button>
    </Card>
  );
}