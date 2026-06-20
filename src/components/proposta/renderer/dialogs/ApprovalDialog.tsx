import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit?: (cliente: { nome: string; email: string }) => Promise<void>;
}

export function ApprovalDialog({ open, onOpenChange, onSubmit }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!nome.trim() || !email.trim() || !onSubmit) return;
    setLoading(true);
    try {
      await onSubmit({ nome: nome.trim(), email: email.trim() });
      onOpenChange(false);
      setNome(""); setEmail("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar proposta</DialogTitle>
          <DialogDescription>
            Ao confirmar, registramos sua aprovação e iniciamos o briefing comercial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ap-nome">Nome completo</Label>
            <Input id="ap-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-email">E-mail</Label>
            <Input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handle} disabled={loading || !nome.trim() || !email.trim()}>
            <Check className="size-4 mr-1" />
            {loading ? "Registrando..." : "Confirmar aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}