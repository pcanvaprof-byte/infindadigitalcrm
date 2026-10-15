import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  connectGmail,
  getGmailStatus,
  sendGmail,
  type GmailTokenStatus,
} from "@/lib/gmail/api";
import { renderTemplate, sanitizeTemplateForSend } from "@/lib/cadencia/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Email do lead (destinatário) */
  toEmail: string;
  /** Nome da empresa (para o template) */
  company: string;
  /** Nome do contato (placeholder {{primeiro_nome}}) */
  responsavel?: string;
  /** Template de corpo já resolvido ou vazio */
  bodyTemplate?: string;
  /** Chamado quando o email foi enviado com sucesso */
  onSent?: (messageId: string, from: string) => void;
}

const DEFAULT_SUBJECT = "Uma oportunidade para {{empresa}}";

export function GmailEmailModal({
  open,
  onOpenChange,
  toEmail,
  company,
  responsavel = "",
  bodyTemplate = "",
  onSent,
}: Props) {
  const [gmailStatus, setGmailStatus] = useState<GmailTokenStatus>({ connected: false });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Carrega status do Gmail ao abrir
  useEffect(() => {
    if (!open) { setSent(false); return; }
    setLoadingStatus(true);
    getGmailStatus()
      .then(setGmailStatus)
      .finally(() => setLoadingStatus(false));
  }, [open]);

  // Preenche campos com o template ao abrir
  useEffect(() => {
    if (!open) return;
    const ctx = { empresa: company, responsavel };
    setSubject(sanitizeTemplateForSend(renderTemplate(DEFAULT_SUBJECT, ctx)));
    setBody(
      bodyTemplate.trim()
        ? sanitizeTemplateForSend(renderTemplate(bodyTemplate, ctx))
        : `Olá${responsavel ? `, ${responsavel}` : ""},\n\nGostaria de apresentar uma oportunidade para ${company}.\n\nPodemos conversar?`
    );
  }, [open, company, responsavel, bodyTemplate]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectGmail();
      toast.info("Autorize o acesso na janela do Google. Depois feche e reabra este modal.");
    } catch (e) {
      toast.error(`Erro ao conectar Gmail: ${(e as Error).message}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleSend = async () => {
    if (!toEmail) return toast.error("Lead sem email cadastrado.");
    if (!subject.trim()) return toast.error("Informe o assunto.");
    if (!body.trim()) return toast.error("Informe o corpo do email.");

    setSending(true);
    try {
      const result = await sendGmail({ to: toEmail, subject, body });
      if (result.error) throw new Error(result.error);
      setSent(true);
      toast.success(`Email enviado por ${result.from}`);
      onSent?.(result.messageId ?? "", result.from ?? "");
      setTimeout(() => onOpenChange(false), 2000);
    } catch (e) {
      toast.error(`Falha ao enviar: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary-glow" />
            Enviar email para {company}
          </DialogTitle>
          <DialogDescription>
            {gmailStatus.connected
              ? `Enviando como ${gmailStatus.email}`
              : "Conecte sua conta Gmail para enviar emails pelo CRM."}
          </DialogDescription>
        </DialogHeader>

        {loadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !gmailStatus.connected ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-accent p-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">Gmail não conectado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Conecte sua conta Google para enviar emails diretamente pelo CRM.
                O email sairá da sua conta pessoal.
              </p>
            </div>
            <Button onClick={handleConnect} disabled={connecting} className="btn-gradient">
              {connecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Conectar Gmail
            </Button>
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="font-semibold text-emerald-400">Email enviado com sucesso!</p>
            <p className="text-sm text-muted-foreground">Fechando automaticamente…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Para</Label>
              <Input value={toEmail} readOnly className="bg-accent/40 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assunto</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Corpo</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="resize-none text-sm"
                placeholder="Corpo do email…"
              />
            </div>
          </div>
        )}

        {gmailStatus.connected && !sent && (
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={sending} className="btn-gradient">
              {sending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
              ) : (
                <><Mail className="mr-2 h-4 w-4" /> Enviar pelo Gmail</>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
