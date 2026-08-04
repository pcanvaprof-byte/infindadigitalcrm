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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Resultado da visita</Label>
            <div className="grid grid-cols-2 gap-2">
              {VISIT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 rounded-md border px-2 py-2 text-xs transition ${
                    status === s
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border/60 hover:bg-accent"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                    style={{ background: visitColor(s) }}
                  />
                  {s}
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

          <div className="space-y-1.5">
            <Label className="text-xs">Falei com (opcional)</Label>
            <Input
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Nome do contato / decisor"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observação rápida</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: dono só atende de manhã, pediu proposta por WhatsApp…"
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="h-9">
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="btn-gradient h-9">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}