import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addTouchpoint,
  cadenceKeys,
  CADENCE_TEMPLATES,
  type CadenceStep,
  type TouchpointTipo,
  type TouchpointResultado,
} from "@/lib/cadence/api";
import { crmKeys } from "@/lib/crm/api";

const TIPOS: { value: TouchpointTipo; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "Email" },
  { value: "reuniao", label: "Reunião" },
  { value: "nota", label: "Nota interna" },
];

const RESULTADOS: { value: TouchpointResultado; label: string }[] = [
  { value: "enviado", label: "Enviado / realizado (sem resposta ainda)" },
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "respondido", label: "Respondeu" },
  { value: "interessado", label: "Interessado" },
  { value: "sem_interesse", label: "Sem interesse" },
];

export interface TouchpointModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospectId: string;
  company: string;
  /** step atual do prospect — usado para sugerir template */
  cadenceStep?: CadenceStep;
  defaultTipo?: TouchpointTipo;
  ownerName?: string;
}

export function TouchpointModal(props: TouchpointModalProps) {
  const { open, onOpenChange, prospectId, company, cadenceStep = 0, defaultTipo = "whatsapp", ownerName } = props;
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TouchpointTipo>(defaultTipo);
  const [resultado, setResultado] = useState<TouchpointResultado>("enviado");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (!open) return;
    setTipo(defaultTipo);
    setResultado("enviado");
    const tpl = (CADENCE_TEMPLATES[cadenceStep] || "")
      .replace("{company}", company)
      .replace("{owner}", ownerName || "");
    setMensagem(tpl);
  }, [open, defaultTipo, cadenceStep, company, ownerName]);

  const m = useMutation({
    mutationFn: () =>
      addTouchpoint({ prospect_id: prospectId, tipo, resultado, mensagem: mensagem.trim() || null }),
    onSuccess: () => {
      toast.success("Contato registrado — cadência atualizada.");
      qc.invalidateQueries({ queryKey: crmKeys.prospects });
      qc.invalidateQueries({ queryKey: cadenceKeys.dashboard });
      qc.invalidateQueries({ queryKey: cadenceKeys.acoesHoje });
      qc.invalidateQueries({ queryKey: cadenceKeys.timeline(prospectId) });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(`Falha: ${(e as Error).message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar contato — {company}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TouchpointTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Resultado</Label>
              <Select value={resultado} onValueChange={(v) => setResultado(v as TouchpointResultado)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESULTADOS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Mensagem (template editável)</Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={5}
              placeholder="Mensagem enviada / nota da ligação…"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Template sugerido para o passo atual da cadência. Edite à vontade.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="btn-gradient" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Salvando…" : "Registrar contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}