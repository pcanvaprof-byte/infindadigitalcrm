import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import {
  registerCheckin,
  VISIT_STATUSES,
  visitColor,
  type VisitStatus,
} from "@/lib/visits/api";
import { isOnline } from "@/lib/visits/offline";
import type { MapPoint } from "@/lib/tasks-map-api";

interface Props {
  point: MapPoint | null;
  onClose: () => void;
  onSaved: () => void;
}

export function VisitCheckinDialog({ point, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<VisitStatus>("Visitado");
  const [contato, setContato] = useState("");
  const [obs, setObs] = useState("");
  const [retornar, setRetornar] = useState("");
  const [saving, setSaving] = useState(false);
  const offline = !isOnline();

  useEffect(() => {
    if (point) {
      setStatus("Visitado");
      setContato("");
      setObs("");
      setRetornar("");
    }
  }, [point]);

  const save = async () => {
    if (!point) return;
    setSaving(true);
    try {
      const addr = [point.logradouro, point.numero, point.bairro, point.cidade, point.uf]
        .filter(Boolean)
        .join(", ");
      const { queued } = await registerCheckin({
        cnpj: point.cnpj,
        company: point.company,
        status,
        contato_nome: contato.trim() || null,
        observacoes: obs.trim() || null,
        retornar_em: status === "Reagendar" && retornar ? retornar : null,
        lat: point.lat ?? null,
        lon: point.lon ?? null,
        endereco_snapshot: addr || null,
      });
      toast.success(
        queued
          ? "Sem sinal — check-in salvo no aparelho e será enviado ao reconectar."
          : `Check-in registrado: ${point.company}`,
      );
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Falha ao registrar visita: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!point} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base">Check-in de visita</DialogTitle>
          <DialogDescription className="truncate">
            {point?.company} · CNPJ {point?.cnpj}
          </DialogDescription>
        </DialogHeader>

        {offline && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600">
            <WifiOff className="h-3.5 w-3.5" /> Sem conexão — o check-in ficará na fila.
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resultado da visita</Label>
            <div className="grid grid-cols-2 gap-2">
              {VISIT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition-all active:scale-[0.98] ${
                    status === s
                      ? "border-primary bg-primary/10 font-semibold ring-1 ring-primary/20"
                      : "border-border/60 bg-muted/30 hover:bg-accent"
                  }`}
                >
                  <span
                    className="inline-block h-3 w-3 flex-none rounded-full shadow-sm"
                    style={{ background: visitColor(s) }}
                  />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          </div>

          {status === "Reagendar" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Voltar em</Label>
              <Input
                type="date"
                value={retornar}
                onChange={(e) => setRetornar(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Falei com (opcional)</Label>
            <Input
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Nome do contato / decisor"
              className="h-11 text-sm lg:h-9 lg:text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observação rápida</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: dono só atende de manhã, pediu proposta por WhatsApp…"
              rows={3}
              className="text-sm lg:text-xs min-h-[100px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="w-full h-11 lg:h-9 order-2 sm:order-1">
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="btn-gradient w-full h-11 lg:h-9 order-1 sm:order-2">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}