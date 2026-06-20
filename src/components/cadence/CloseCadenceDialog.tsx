import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  closeCadence,
  cadenceKeys,
  CLOSE_REASON_LABEL,
  type CloseReason,
} from "@/lib/cadence/api";
import { crmKeys } from "@/lib/crm/api";

export interface CloseCadenceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospectId: string;
  company: string;
}

const REASONS: CloseReason[] = ["sem_interesse", "numero_invalido", "empresa_fechada", "cliente", "outro"];

export function CloseCadenceDialog({ open, onOpenChange, prospectId, company }: CloseCadenceDialogProps) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<CloseReason>("sem_interesse");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: () => closeCadence(prospectId, reason, note.trim() || undefined),
    onSuccess: () => {
      toast.success(`Cadência encerrada — ${company}`);
      qc.invalidateQueries({ queryKey: cadenceKeys.dashboard });
      qc.invalidateQueries({ queryKey: cadenceKeys.acoesHoje });
      qc.invalidateQueries({ queryKey: cadenceKeys.timeline(prospectId) });
      qc.invalidateQueries({ queryKey: crmKeys.prospects });
      setNote("");
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    },
  });

  const requiresNote = reason === "outro";
  const canSubmit = !m.isPending && (!requiresNote || note.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encerrar cadência</DialogTitle>
          <DialogDescription>
            {company} sairá do fluxo de follow-up. Esta ação é registrada no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CloseReason)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{CLOSE_REASON_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Observação {requiresNote ? <span className="text-rose-300">*</span> : <span className="text-muted-foreground">(opcional)</span>}
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalhe o motivo do encerramento…"
              className="min-h-[80px] text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={m.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Encerrando…" : "Encerrar cadência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}