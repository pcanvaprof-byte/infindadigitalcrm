import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { listTemplates, registerSend, markProspectContactedFromLead } from "@/lib/cadencia/api";
import { renderTemplate, leadElegivelParaDisparo, type CadLead } from "@/lib/cadencia/types";
import { wasDispatchedToday, dispatchBlockedMessage } from "@/lib/dispatch-lock";

function onlyDigits(s: string) { return (s || "").replace(/\D+/g, ""); }
/** Normaliza telefone BR para E.164 sem sinal, garantindo DDI 55. */
function waPhone(raw: string): string {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  // BR sem DDI (10 ou 11 dígitos: DDD + número)
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

export function SendMessageDialog({
  lead, open, onOpenChange,
}: { lead: CadLead | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const tpls = useQuery({ queryKey: ["cad-templates"], queryFn: listTemplates, enabled: open });
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!lead || !open) return;
    const tpl = (tpls.data ?? []).find((t) => t.stage === lead.stage);
    if (tpl) setMsg(renderTemplate(tpl.corpo, lead));
    else setMsg("");
  }, [lead, open, tpls.data]);

  function isMobile() {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  async function handleSend() {
    if (!lead || !msg.trim() || sending) return;
    // TRAVA DE ELEGIBILIDADE: bloqueia antes de tudo (frontend).
    const elig = leadElegivelParaDisparo(lead);
    if (!elig.elegivel) {
      toast.error(elig.motivo || "Lead não elegível para disparo.");
      return;
    }
    const phone = waPhone(lead.whatsapp || lead.telefone || "");
    if (!phone) {
      toast.warning("Lead sem telefone/WhatsApp.");
      return;
    }
    setSending(true);
    // Trava: verifica se já houve disparo hoje em Cadência ou Prospecção.
    const lock = await wasDispatchedToday({
      leadId: lead.id,
      prospectId: lead.prospect_id ?? null,
    });
    if (lock.blocked) {
      toast.error(dispatchBlockedMessage(lock.source!));
      setSending(false);
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

    // ESTRATÉGIA: no desktop abrimos a aba IMEDIATAMENTE (dentro do gesto)
    // e registramos depois — a página atual fica viva.
    // No mobile, `window.location.href` mata o JS antes do await chegar ao
    // banco, deixando o card preso no stage. Por isso registramos PRIMEIRO
    // e só então navegamos. A trava `wasDispatchedToday` (já checada acima)
    // evita duplicata se o usuário reenviar.
    const mobile = isMobile();
    if (!mobile) {
      window.open(url, "_blank", "noopener,noreferrer");
    }

    try {
      await registerSend({ leadId: lead.id, tipo: "whatsapp", mensagem: msg, advance: true });
      try {
        await markProspectContactedFromLead(lead.id);
      } catch (syncErr) {
        console.warn("Falha ao sincronizar status do prospect:", syncErr);
      }
      toast.success("Mensagem registrada");
      qc.invalidateQueries({ queryKey: ["cad-leads"] });
      qc.invalidateQueries({ queryKey: ["cad-messages"] });
      qc.invalidateQueries({ queryKey: ["cad-metrics"] });
      qc.invalidateQueries({ queryKey: ["prospects"] });
    } catch (e) {
      toast.error(
        `Falha ao registrar disparo: ${(e as Error).message}. WhatsApp NÃO será aberto para evitar envio sem registro.`,
      );
      setSending(false);
      return;
    } finally {
      setSending(false);
      onOpenChange(false);
    }

    if (mobile) {
      // Registro confirmado: agora pode navegar para o WhatsApp.
      window.location.href = url;
    }
  }

  function copy() {
    navigator.clipboard.writeText(msg).then(() => toast.success("Copiado"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar mensagem — {lead?.empresa}</DialogTitle>
        </DialogHeader>
        <Textarea rows={10} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-2" /> Copiar</Button>
          {(() => {
            const elig = lead ? leadElegivelParaDisparo(lead) : { elegivel: true } as const;
            return (
              <Button
                onClick={handleSend}
                disabled={sending || !msg.trim() || !elig.elegivel}
                title={elig.elegivel ? undefined : elig.motivo}
              >
                <Send className="h-4 w-4 mr-2" />
                {elig.elegivel ? "Enviar via WhatsApp" : "Aguardando data"}
              </Button>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}