import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Send } from "lucide-react";
import { useState } from "react";
import {
  CAD_FOLLOWUP_DAYS,
  diasSemResposta,
  renderTemplate,
  leadElegivelParaDisparo,
  type CadLead,
  type CadTemplate,
} from "@/lib/cadencia/types";
import { TemperaturaBadge } from "./TemperaturaBadge";
import { StageBadge } from "./StageBadge";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function LeadCard({
  lead,
  onOpen,
  onSend,
  template,
}: {
  lead: CadLead;
  onOpen: () => void;
  onSend: () => void;
  template?: CadTemplate | null;
}) {
  const dias = diasSemResposta(lead);
  const overdue =
    lead.next_action_at && new Date(lead.next_action_at).getTime() < Date.now();
  const elig = leadElegivelParaDisparo(lead);
  const [showPreview, setShowPreview] = useState(false);
  const dia = CAD_FOLLOWUP_DAYS[lead.stage];
  const preview = template ? renderTemplate(template.corpo, lead) : "";
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
      <div className="mt-2">
        <StageBadge stage={lead.stage} />
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
      <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-2">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="flex w-full items-center justify-between text-[11px] text-muted-foreground hover:text-foreground"
        >
          <span className="truncate">
            {template ? (
              <>
                {dia ? `Dia ${dia} · ` : ""}
                <span className="text-foreground font-medium">{template.titulo}</span>
              </>
            ) : (
              <span className="text-amber-400">Sem template para esta etapa</span>
            )}
          </span>
          {template && (showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        {showPreview && template && (
          <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-snug text-foreground/90 font-sans">
            {preview}
          </pre>
        )}
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2 w-full h-7 text-xs"
        onClick={onSend}
        disabled={!elig.elegivel}
        title={elig.elegivel ? undefined : elig.motivo}
      >
        <Send className="h-3 w-3 mr-1" />
        {elig.elegivel ? "Enviar Mensagem" : "Aguardando data"}
      </Button>
      {!elig.elegivel && elig.motivo && (
        <div className="mt-1 text-[10px] text-muted-foreground leading-tight">{elig.motivo}</div>
      )}
    </Card>
  );
}