import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Send, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { resolveTemplate, registerSend, markProspectContactedFromLead } from "@/lib/cadencia/api";
import {
  renderTemplate,
  sanitizeTemplateForSend,
  expandVariants,
  leadElegivelParaDisparo,
  type CadLead,
} from "@/lib/cadencia/types";
import { chooseVariant } from "@/lib/prospeccao/variant-telemetry";
import { wasDispatchedToday, dispatchBlockedMessage } from "@/lib/dispatch-lock";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  const tplQ = useQuery({
    queryKey: ["cad-resolved-template", lead?.stage ?? null],
    queryFn: () => resolveTemplate(lead!.stage),
    enabled: open && !!lead,
  });
  const [msg, setMsg] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [variantIdx, setVariantIdx] = useState(0);
  const [sending, setSending] = useState(false);
  type WaAccount = "default" | "business" | "personal";
  const [account, setAccount] = useState<WaAccount>("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("wa_account") as WaAccount | null;
    if (saved === "business" || saved === "personal" || saved === "default") setAccount(saved);
  }, []);
  function changeAccount(v: WaAccount) {
    setAccount(v);
    try { window.localStorage.setItem("wa_account", v); } catch { /* ignore */ }
  }
  function isAndroid() {
    return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  }
  function buildSendUrl(phone: string, text: string, acc: WaAccount): string {
    const encoded = encodeURIComponent(text);
    if (isAndroid() && acc !== "default") {
      const pkg = acc === "business" ? "com.whatsapp.w4b" : "com.whatsapp";
      return `intent://send?phone=${phone}&text=${encoded}#Intent;scheme=whatsapp;package=${pkg};end`;
    }
    return `https://wa.me/${phone}?text=${encoded}`;
  }

  useEffect(() => {
    if (!lead || !open) return;
    const corpo = tplQ.data?.corpo ?? "";
    const parts = expandVariants(corpo);
    setVariants(parts);
    if (parts.length === 0) {
      setVariantIdx(0);
      setMsg("");
      return;
    }
    // Round-robin + telemetria (source/index/hash) via chooseVariant.
    const pick = chooseVariant(corpo, {
      scope: "cadencia",
      bucketKey: `cad:${lead.stage}`,
      stage: lead.stage,
      leadId: lead.id,
      company: lead.empresa ?? null,
    });
    // parts vem de expandVariants (mesma fonte usada pelo chooseVariant),
    // então o índice bate 1:1 exceto quando o template tem `---` (explicit).
    const idxInParts = parts.indexOf(pick.text);
    setVariantIdx(idxInParts >= 0 ? idxInParts : 0);
    setMsg(renderTemplate(pick.text, lead));
  }, [lead, open, tplQ.data]);

  function cycleVariant() {
    if (!lead || variants.length <= 1) return;
    const next = (variantIdx + 1) % variants.length;
    setVariantIdx(next);
    setMsg(renderTemplate(variants[next], lead));
  }

  function isMobile() {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  async function handleSend() {
    if (!lead || !msg.trim() || sending) return;
    // Sanitiza antes do envio: remove placeholders remanescentes e
    // limpa espaços/pontuação. Preview mantém `{{...}}` cru para o
    // operador identificar templates incompletos.
    const sendMsg = sanitizeTemplateForSend(msg);
    if (!sendMsg) {
      toast.warning("Mensagem vazia após limpeza.");
      return;
    }
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
    const url = buildSendUrl(phone, sendMsg, account);

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
      await registerSend({ leadId: lead.id, tipo: "whatsapp", mensagem: sendMsg, advance: true });
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
        {variants.length > 1 && (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Variante {variantIdx + 1} de {variants.length} — rotação automática anti-bloqueio.
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={cycleVariant}>
              <Shuffle className="h-4 w-4 mr-1" /> Trocar
            </Button>
          </div>
        )}
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label className="text-xs font-medium text-muted-foreground">Conta do WhatsApp</Label>
          <RadioGroup
            value={account}
            onValueChange={(v) => changeAccount(v as WaAccount)}
            className="flex flex-col gap-1 sm:flex-row sm:gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="default" id="wa-default" />
              <span>Padrão do sistema</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="personal" id="wa-personal" />
              <span>WhatsApp Normal</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="business" id="wa-business" />
              <span>WhatsApp Business</span>
            </label>
          </RadioGroup>
          <p className="text-[11px] leading-snug text-muted-foreground">
            A escolha entre Normal e Business só é forçada no Android. No iPhone e
            desktop, o link abre o app definido como padrão do sistema — troque o
            padrão no aparelho/computador para usar a outra conta.
          </p>
        </div>
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