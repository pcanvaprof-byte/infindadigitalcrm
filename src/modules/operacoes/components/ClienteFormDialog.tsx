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
import { upsertCliente } from "../api";
import { OP_CLIENTE_STATUS_LABEL, type OpCliente, type OpClienteStatus } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: OpCliente | null;
};

const empty = {
  nome: "",
  empresa: "",
  email: "",
  telefone: "",
  whatsapp: "",
  observacoes: "",
  status: "ativo" as OpClienteStatus,
};

export function ClienteFormDialog({ open, onOpenChange, cliente }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (cliente) {
      setForm({
        nome: cliente.nome ?? "",
        empresa: cliente.empresa ?? "",
        email: cliente.email ?? "",
        telefone: cliente.telefone ?? "",
        whatsapp: cliente.whatsapp ?? "",
        observacoes: cliente.observacoes ?? "",
        status: cliente.status ?? "ativo",
      });
    } else if (open) {
      setForm(empty);
    }
  }, [cliente, open]);

  const m = useMutation({
    mutationFn: () =>
      upsertCliente({ ...form, id: cliente?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-clientes"] });
      qc.invalidateQueries({ queryKey: ["op-dashboard"] });
      toast.success(cliente ? "Cliente atualizado" : "Cliente criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Nome *</label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Empresa</label>
              <Input
                value={form.empresa}
                onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as OpClienteStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OP_CLIENTE_STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Telefone</label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">WhatsApp</label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Observações</label>
              <Input
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || !form.nome.trim()}
          >
            {m.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}