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
import { upsertCampanha } from "../api";
import {
  OP_PLATAFORMA_LABEL,
  type OpCliente,
  type OpPlataforma,
  type OpTrafegoCampanha,
} from "../types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientes: OpCliente[];
  campanha?: OpTrafegoCampanha | null;
  defaultClienteId?: string | null;
};

const empty = {
  cliente_id: "",
  plataforma: "meta_ads" as OpPlataforma,
  nome: "",
  status: "ativa",
  verba: 0,
  gasto: 0,
  impressoes: 0,
  cliques: 0,
  conversoes: 0,
  cpa: 0,
  roas: 0,
  periodo_inicio: "",
  periodo_fim: "",
};

export function CampanhaFormDialog({ open, onOpenChange, clientes, campanha, defaultClienteId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (campanha) {
      setForm({
        cliente_id: campanha.cliente_id,
        plataforma: campanha.plataforma,
        nome: campanha.nome ?? "",
        status: campanha.status ?? "ativa",
        verba: Number(campanha.verba ?? 0),
        gasto: Number(campanha.gasto ?? 0),
        impressoes: Number(campanha.impressoes ?? 0),
        cliques: Number(campanha.cliques ?? 0),
        conversoes: Number(campanha.conversoes ?? 0),
        cpa: Number(campanha.cpa ?? 0),
        roas: Number(campanha.roas ?? 0),
        periodo_inicio: campanha.periodo_inicio ?? "",
        periodo_fim: campanha.periodo_fim ?? "",
      });
    } else if (open) {
      setForm({ ...empty, cliente_id: defaultClienteId ?? clientes[0]?.id ?? "" });
    }
  }, [campanha, open, defaultClienteId, clientes]);

  const m = useMutation({
    mutationFn: () =>
      upsertCampanha({
        ...form,
        id: campanha?.id,
        cliente_id: form.cliente_id,
        nome: form.nome,
        plataforma: form.plataforma,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-campanhas"] });
      qc.invalidateQueries({ queryKey: ["op-dashboard"] });
      toast.success(campanha ? "Campanha atualizada" : "Campanha criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) || 0 }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{campanha ? "Editar campanha" : "Nova campanha"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Cliente *</label>
            <Select
              value={form.cliente_id}
              onValueChange={(v) => setForm((f) => ({ ...f, cliente_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                    {c.empresa ? ` — ${c.empresa}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Plataforma</label>
            <Select
              value={form.plataforma}
              onValueChange={(v) => setForm((f) => ({ ...f, plataforma: v as OpPlataforma }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OP_PLATAFORMA_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Input
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Nome da campanha *</label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Verba (R$)</label>
            <Input type="number" value={form.verba} onChange={num("verba")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Gasto (R$)</label>
            <Input type="number" value={form.gasto} onChange={num("gasto")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Impressões</label>
            <Input type="number" value={form.impressoes} onChange={num("impressoes")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Cliques</label>
            <Input type="number" value={form.cliques} onChange={num("cliques")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Conversões</label>
            <Input type="number" value={form.conversoes} onChange={num("conversoes")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">CPA</label>
            <Input type="number" value={form.cpa} onChange={num("cpa")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">ROAS</label>
            <Input type="number" value={form.roas} onChange={num("roas")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input
              type="date"
              value={form.periodo_inicio}
              onChange={(e) => setForm((f) => ({ ...f, periodo_inicio: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input
              type="date"
              value={form.periodo_fim}
              onChange={(e) => setForm((f) => ({ ...f, periodo_fim: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || !form.cliente_id || !form.nome.trim()}
          >
            {m.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}