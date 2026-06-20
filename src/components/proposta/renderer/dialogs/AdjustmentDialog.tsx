import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit?: (mensagem: string, cliente: { nome: string; email: string }) => Promise<void>;
}

export function AdjustmentDialog({ open, onOpenChange, onSubmit }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!mensagem.trim() || !nome.trim() || !onSubmit) return;
    setLoading(true);
    try {
      await onSubmit(mensagem.trim(), { nome: nome.trim(), email: email.trim() });
      onOpenChange(false);
      setMensagem("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar ajuste</DialogTitle>
          <DialogDescription>Descreva o que precisa ser revisto. Seu consultor recebe na hora.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="aj-nome">Seu nome</Label>
              <Input id="aj-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aj-email">E-mail</Label>
              <Input id="aj-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="aj-msg">O que ajustar?</Label>
            <Textarea id="aj-msg" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={5} maxLength={1500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handle} disabled={loading || !mensagem.trim() || !nome.trim()}>
            {loading ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}