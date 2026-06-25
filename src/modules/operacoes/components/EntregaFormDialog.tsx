import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertEntrega } from "../api";
import {
  OP_ENTREGA_STATUS_LABEL,
  OP_ENTREGA_TIPO_LABEL,
  type OpCliente,
  type OpEntrega,
  type OpEntregaStatus,
  type OpEntregaTipo,
} from "../types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientes: OpCliente[];
  entrega?: OpEntrega | null;
  defaultStatus?: OpEntregaStatus;
};

const empty = {
  cliente_id: "",
  titulo: "",
  tipo: "outro" as OpEntregaTipo,
  status: "backlog" as OpEntregaStatus,
  prazo: "",
  descricao: "",
};

export function EntregaFormDialog({ open, onOpenChange, clientes, entrega, defaultStatus }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (entrega) {
      setForm({
        cliente_id: entrega.cliente_id ?? "",
        titulo: entrega.titulo,
        tipo: entrega.tipo,
        status: entrega.status,
        prazo: entrega.prazo ?? "",
        descricao: entrega.descricao ?? "",
      });
    } else if (open) {
      setForm({ ...empty, status: defaultStatus ?? "backlog" });
    }
  }, [entrega, open, defaultStatus]);

  const m = useMutation({
    mutationFn: () => upsertEntrega({ ...form, id: entrega?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-entregas"] });
      qc.invalidateQueries({ queryKey: ["op-dashboard"] });
      toast.success(entrega ? "Entrega atualizada" : "Entrega criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entrega ? "Editar entrega" : "Nova entrega"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Título *</label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as OpEntregaTipo }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OP_ENTREGA_TIPO_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as OpEntregaStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OP_ENTREGA_STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cliente</label>
              <Select
                value={form.cliente_id || "__none"}
                onValueChange={(v) => setForm((f) => ({ ...f, cliente_id: v === "__none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Sem cliente —</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prazo</label>
              <Input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || !form.titulo.trim()}
          >
            {m.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}