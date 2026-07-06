import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getClient, updateClient } from "@/modules/lifecycle/api";
import {
  addAdjustmentNote,
  deleteAdjustmentNote,
  listAdjustmentNotes,
} from "@/lib/adjustments/api";
import { AlertTriangle, MessageSquarePlus, Trash2 } from "lucide-react";

export function AjustesCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const cq = useQuery({ queryKey: ["lc-client", clientId], queryFn: () => getClient(clientId) });
  const nq = useQuery({
    queryKey: ["adj-notes", clientId],
    queryFn: () => listAdjustmentNotes(clientId),
  });

  const [escopo, setEscopo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [proxima, setProxima] = useState("");
  const [novaNota, setNovaNota] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!cq.data) return;
    setEscopo(cq.data.ajustes_escopo ?? "");
    setPrazo(cq.data.ajustes_prazo ? cq.data.ajustes_prazo.slice(0, 10) : "");
    setProxima(cq.data.ajustes_proxima_acao ?? "");
    setDirty(false);
  }, [cq.data]);

  const saveM = useMutation({
    mutationFn: () =>
      updateClient(clientId, {
        ajustes_escopo: escopo.trim() || null,
        ajustes_prazo: prazo || null,
        ajustes_proxima_acao: proxima.trim() || null,
        ajustes_updated_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lc-client", clientId] });
      toast.success("Ajustes atualizados");
      setDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addM = useMutation({
    mutationFn: () => addAdjustmentNote(clientId, novaNota.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adj-notes", clientId] });
      setNovaNota("");
      toast.success("Nota adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deleteAdjustmentNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adj-notes", clientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazoDate = prazo ? new Date(prazo + "T00:00:00") : null;
  const atrasado = prazoDate && prazoDate < hoje;
  const emAte3 = prazoDate && !atrasado && (prazoDate.getTime() - hoje.getTime()) / 86400000 <= 3;

  const hasAny = escopo || prazo || proxima || (nq.data && nq.data.length > 0);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-semibold">Ajustes solicitados</p>
          {hasAny && cq.data?.ajustes_updated_at && (
            <span className="text-[11px] text-muted-foreground">
              · atualizado em {new Date(cq.data.ajustes_updated_at).toLocaleString("pt-BR")}
            </span>
          )}
        </div>
        {atrasado && (
          <span className="rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
            Prazo vencido
          </span>
        )}
        {emAte3 && (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-400">
            Prazo próximo
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Escopo dos ajustes</Label>
          <Textarea
            rows={3}
            placeholder="O que o cliente pediu para alterar / negociar. Ex.: reduzir valor de implantação, ajustar cronograma, incluir integração com WhatsApp."
            value={escopo}
            onChange={(e) => { setEscopo(e.target.value); setDirty(true); }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Prazo acordado</Label>
          <Input
            type="date"
            value={prazo}
            onChange={(e) => { setPrazo(e.target.value); setDirty(true); }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Próxima ação</Label>
          <Input
            placeholder="Ex.: enviar proposta revisada até 6ª"
            value={proxima}
            onChange={(e) => { setProxima(e.target.value); setDirty(true); }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" disabled={!dirty || saveM.isPending} onClick={() => saveM.mutate()}>
          {saveM.isPending ? "Salvando…" : "Salvar ajustes"}
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de notas
        </p>
        <div className="flex gap-2">
          <Textarea
            rows={2}
            placeholder="Registre uma nova conversa, ajuste combinado ou observação…"
            value={novaNota}
            onChange={(e) => setNovaNota(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            disabled={!novaNota.trim() || addM.isPending}
            onClick={() => addM.mutate()}
          >
            <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>

        <ul className="space-y-2">
          {(nq.data ?? []).map((n) => (
            <li key={n.id} className="rounded border border-border/60 bg-muted/20 p-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap">{n.nota}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => delM.mutate(n.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {n.autor_nome ?? "—"} · {new Date(n.created_at).toLocaleString("pt-BR")}
              </p>
            </li>
          ))}
          {(nq.data ?? []).length === 0 && (
            <li className="text-center text-xs text-muted-foreground">Nenhuma nota registrada.</li>
          )}
        </ul>
      </div>
    </Card>
  );
}