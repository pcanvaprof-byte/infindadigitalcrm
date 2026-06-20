import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Motivo = "preco" | "concorrente" | "sem_orcamento" | "timing" | "desistencia" | "outros";

const MOTIVOS: { value: Motivo; label: string }[] = [
  { value: "preco", label: "Preço" },
  { value: "concorrente", label: "Fechei com concorrente" },
  { value: "sem_orcamento", label: "Sem orçamento no momento" },
  { value: "timing", label: "Timing ruim" },
  { value: "desistencia", label: "Desisti do projeto" },
  { value: "outros", label: "Outros" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit?: (motivo: string, observacao?: string) => Promise<void>;
}

export function RejectDialog({ open, onOpenChange, onSubmit }: Props) {
  const [motivo, setMotivo] = useState<Motivo | "">("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!motivo || !onSubmit) return;
    setLoading(true);
    try {
      await onSubmit(motivo, obs.trim() || undefined);
      onOpenChange(false);
      setMotivo(""); setObs("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar proposta</DialogTitle>
          <DialogDescription>Conte o que motivou a decisão — isso nos ajuda a melhorar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motivo principal</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as Motivo)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rj-obs">Observação (opcional)</Label>
            <Textarea id="rj-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={4} maxLength={1000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handle} disabled={loading || !motivo}>
            {loading ? "Registrando..." : "Confirmar recusa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}