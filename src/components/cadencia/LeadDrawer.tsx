import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CAD_STAGES, CAD_STAGE_LABEL, CAD_TEMP_LABEL, type CadLead, type CadStage, type CadTemp } from "@/lib/cadencia/types";
import { moveStage, registerResponse, updateLead, setTemperatura, deleteLead } from "@/lib/cadencia/api";
import { addInteractionRemote } from "@/lib/prospects-api";
import { LeadTimeline } from "./LeadTimeline";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

// Etapas que implicam que houve resposta do cliente
const STAGES_REQUIRE_RESPONSE: CadStage[] = [
  "interessado",
  "reuniao_agendada",
  "proposta_enviada",
  "negociacao",
  "fechado",
  "perdido",
];

export function LeadDrawer({
  lead, open, onOpenChange, onSend,
}: { lead: CadLead | null; open: boolean; onOpenChange: (o: boolean) => void; onSend: () => void }) {
  const qc = useQueryClient();
  const [respText, setRespText] = useState("");
  const [pendingStage, setPendingStage] = useState<CadStage | null>(null);
  const [pendingRespText, setPendingRespText] = useState("");
  const [pendingSpokeResp, setPendingSpokeResp] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cad-leads"] });
    qc.invalidateQueries({ queryKey: ["cad-messages"] });
    qc.invalidateQueries({ queryKey: ["cad-metrics"] });
    qc.invalidateQueries({ queryKey: ["prospects"] });
    // Dashboard usa ["dashboard", "v6"] e ["dashboard", "trends-14d"].
    // Invalida tudo que começa com "dashboard" para refletir KPIs em tempo real.
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const moveM = useMutation({
    mutationFn: (s: CadStage) => moveStage(lead!.id, s),
    onSuccess: () => { invalidate(); toast.success("Etapa atualizada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const tempM = useMutation({
    mutationFn: (t: CadTemp) => setTemperatura(lead!.id, t),
    onSuccess: () => { invalidate(); toast.success("Temperatura atualizada"); },
  });
  const respM = useMutation({
    mutationFn: (txt: string) => registerResponse(lead!.id, txt),
    onSuccess: () => { invalidate(); setRespText(""); toast.success("Resposta registrada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const nextDateM = useMutation({
    mutationFn: (iso: string) => updateLead(lead!.id, { next_action_at: iso }),
    onSuccess: () => { invalidate(); toast.success("Próxima ação reagendada"); },
  });
  const delM = useMutation({
    mutationFn: () => deleteLead(lead!.id),
    onSuccess: () => { invalidate(); toast.success("Lead removido"); onOpenChange(false); },
  });

  // Intercepta mudança de etapa: se a nova etapa implica resposta do cliente,
  // pergunta antes se ele respondeu (e registra junto para refletir no dashboard).
  function requestStageChange(next: CadStage) {
    if (!lead || next === lead.stage) return;
    if (STAGES_REQUIRE_RESPONSE.includes(next)) {
      setPendingStage(next);
      setPendingRespText("");
      setPendingSpokeResp(false);
    } else {
      moveM.mutate(next);
    }
  }

  async function confirmStageChange(registerResp: boolean) {
    if (!pendingStage || !lead) return;
    const next = pendingStage;
    const txt = pendingRespText.trim();
    const spoke = pendingSpokeResp;
    setPendingStage(null);
    try {
      if (registerResp) {
        await registerResponse(lead.id, txt || "[resposta registrada na mudança de etapa]");
      }
      if (spoke && lead.prospect_id) {
        const respNome = lead.responsavel || "responsável";
        await addInteractionRemote(
          lead.prospect_id,
          "ligacao",
          `Falou com o responsável (${respNome}) — etapa: ${CAD_STAGE_LABEL[next]}`,
          "Sistema",
        );
      }
      await moveStage(lead.id, next);
      invalidate();
      const parts = [];
      if (registerResp) parts.push("resposta");
      if (spoke) parts.push("contato com responsável");
      toast.success(parts.length ? `Etapa atualizada (${parts.join(" + ")})` : "Etapa atualizada");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>{lead.empresa}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Responsável:</span> {lead.responsavel || "—"}</div>
                <div><span className="text-muted-foreground">Cargo:</span> {lead.cargo || "—"}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {lead.telefone || "—"}</div>
                <div><span className="text-muted-foreground">WhatsApp:</span> {lead.whatsapp || "—"}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Etapa</Label>
                  <Select value={lead.stage} onValueChange={(v) => requestStageChange(v as CadStage)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAD_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{CAD_STAGE_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Temperatura</Label>
                  <Select value={lead.temperatura} onValueChange={(v) => tempM.mutate(v as CadTemp)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["quente","morno","frio"] as CadTemp[]).map((t) => (
                        <SelectItem key={t} value={t}>{CAD_TEMP_LABEL[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Próxima ação</Label>
                <Input
                  type="datetime-local"
                  defaultValue={lead.next_action_at ? lead.next_action_at.slice(0,16) : ""}
                  onBlur={(e) => { if (e.target.value) nextDateM.mutate(new Date(e.target.value).toISOString()); }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={onSend}>Enviar mensagem</Button>
                <Button size="sm" variant="outline" onClick={() => requestStageChange("interessado")}>Marcar interessado</Button>
                <Button size="sm" variant="outline" onClick={() => requestStageChange("reuniao_agendada")}>Reunião agendada</Button>
                <Button size="sm" variant="outline" onClick={() => requestStageChange("perdido")}>Perdido</Button>
                <Button size="sm" variant="ghost" onClick={() => delM.mutate()}>
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir
                </Button>
              </div>

              <div>
                <Label className="text-xs">Registrar resposta recebida</Label>
                <div className="flex gap-2">
                  <Input value={respText} onChange={(e) => setRespText(e.target.value)} placeholder="O que o lead respondeu..." />
                  <Button size="sm" onClick={() => respText.trim() && respM.mutate(respText.trim())}>Registrar</Button>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Timeline</div>
                <LeadTimeline leadId={lead.id} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
      <AlertDialog open={pendingStage !== null} onOpenChange={(o) => { if (!o) setPendingStage(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O cliente respondeu?</AlertDialogTitle>
            <AlertDialogDescription>
              Mover para <b>{pendingStage ? CAD_STAGE_LABEL[pendingStage] : ""}</b>. Se houve resposta do cliente,
              registre o conteúdo abaixo para refletir nos KPIs do dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="O que o cliente respondeu... (opcional)"
            value={pendingRespText}
            onChange={(e) => setPendingRespText(e.target.value)}
            rows={3}
          />
          <label className="mt-2 flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer">
            <Checkbox
              checked={pendingSpokeResp}
              onCheckedChange={(v) => setPendingSpokeResp(v === true)}
              className="mt-0.5"
            />
            <span>
              <b>Falei com o responsável</b>
              {lead?.responsavel ? <> ({lead.responsavel})</> : null}
              <span className="block text-xs text-muted-foreground">
                Registra um contato direto com o decisor no histórico do lead.
              </span>
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => confirmStageChange(false)}>
              Não respondeu, só mudar etapa
            </Button>
            <AlertDialogAction onClick={() => confirmStageChange(true)}>
              Sim, registrar resposta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}