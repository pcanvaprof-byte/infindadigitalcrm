import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { listTemplates, registerSend } from "@/lib/cadencia/api";
import { renderTemplate, type CadLead } from "@/lib/cadencia/types";

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

  useEffect(() => {
    if (!lead || !open) return;
    const tpl = (tpls.data ?? []).find((t) => t.stage === lead.stage);
    if (tpl) setMsg(renderTemplate(tpl.corpo, lead));
    else setMsg("");
  }, [lead, open, tpls.data]);

  const sendM = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      await registerSend({ leadId: lead.id, tipo: "whatsapp", mensagem: msg, advance: true });
      const phone = waPhone(lead.whatsapp || lead.telefone || "");
      if (phone) {
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, "_blank");
      }
    },
    onSuccess: () => {
      toast.success("Mensagem registrada");
      qc.invalidateQueries({ queryKey: ["cad-leads"] });
      qc.invalidateQueries({ queryKey: ["cad-messages"] });
      qc.invalidateQueries({ queryKey: ["cad-metrics"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          <Button onClick={() => sendM.mutate()} disabled={sendM.isPending || !msg.trim()}>
            <Send className="h-4 w-4 mr-2" /> Enviar via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}