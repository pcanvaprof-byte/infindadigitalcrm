import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { listTemplates, registerSend, markProspectContactedFromLead } from "@/lib/cadencia/api";
import { renderTemplate, type CadLead } from "@/lib/cadencia/types";
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

    // 1) Abre o WhatsApp IMEDIATAMENTE dentro do gesto do usuário.
    //    No mobile usa navegação direta (popups são bloqueados); no desktop nova aba.
    if (isMobile()) {
      // Dispara antes de qualquer await para não perder o gesto.
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }

    // 2) Registra em background — não bloqueia a navegação.
    (async () => {
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
        toast.error((e as Error).message);
      } finally {
        setSending(false);
        onOpenChange(false);
      }
    })();
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
          <Button
            onClick={handleSend}
            disabled={sending || !msg.trim()}
          >
            <Send className="h-4 w-4 mr-2" /> Enviar via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}