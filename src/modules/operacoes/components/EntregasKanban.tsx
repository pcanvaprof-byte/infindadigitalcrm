import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  OP_ENTREGA_STATUSES,
  OP_ENTREGA_STATUS_LABEL,
  OP_ENTREGA_TIPO_LABEL,
  type OpCliente,
  type OpEntrega,
  type OpEntregaStatus,
} from "../types";
import { deleteEntrega, updateEntregaStatus } from "../api";
import { EntregaFormDialog } from "./EntregaFormDialog";

type Props = {
  entregas: OpEntrega[];
  clientes: OpCliente[];
};

export function EntregasKanban({ entregas, clientes }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<OpEntrega | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<OpEntregaStatus | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const moveM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OpEntregaStatus }) =>
      updateEntregaStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-entregas"] });
      qc.invalidateQueries({ queryKey: ["op-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deleteEntrega(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-entregas"] });
      qc.invalidateQueries({ queryKey: ["op-dashboard"] });
      toast.success("Entrega removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clienteNome = (id: string | null) =>
    id ? clientes.find((c) => c.id === id)?.nome ?? "Cliente" : "—";

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {OP_ENTREGA_STATUSES.map((status) => {
          const items = entregas.filter((e) => e.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragging;
                if (id) moveM.mutate({ id, status });
                setDragging(null);
              }}
              className="flex min-h-[320px] flex-col rounded-xl border border-border bg-card/50 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {OP_ENTREGA_STATUS_LABEL[status]}
                  </span>
                  <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setCreatingStatus(status)}
                  title="Nova entrega nesta coluna"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                    Solte um card aqui
                  </div>
                )}
                {items.map((e) => {
                  const atrasada = e.prazo && e.prazo < today && e.status !== "entregue";
                  return (
                    <Card
                      key={e.id}
                      draggable
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData("text/plain", e.id);
                        setDragging(e.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={`cursor-grab p-3 active:cursor-grabbing ${
                        dragging === e.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{e.titulo}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {OP_ENTREGA_TIPO_LABEL[e.tipo]} · {clienteNome(e.cliente_id)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setEditing(e)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => {
                              if (confirm("Remover esta entrega?")) delM.mutate(e.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {e.prazo && (
                        <div
                          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                            atrasada
                              ? "bg-destructive/15 text-destructive"
                              : "bg-background/60 text-muted-foreground"
                          }`}
                        >
                          <CalendarDays className="h-3 w-3" />
                          {new Date(e.prazo + "T00:00").toLocaleDateString("pt-BR")}
                          {atrasada ? " · atrasada" : ""}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <EntregaFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        clientes={clientes}
        entrega={editing}
      />
      <EntregaFormDialog
        open={!!creatingStatus}
        onOpenChange={(v) => !v && setCreatingStatus(null)}
        clientes={clientes}
        defaultStatus={creatingStatus ?? undefined}
      />
    </>
  );
}