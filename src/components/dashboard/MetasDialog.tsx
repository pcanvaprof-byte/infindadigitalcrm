import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertOrgGoal, type DashboardV7 } from "@/lib/dashboard/api-v7";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { toast } from "sonner";

export function MetasDialog({ metas }: { metas: DashboardV7["metas"] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    meta_receita:    metas.meta_receita,
    meta_clientes:   metas.meta_clientes,
    meta_contatos:   metas.meta_contatos,
    custo_marketing: metas.custo_marketing,
  });
  useEffect(() => {
    if (open) {
      setForm({
        meta_receita:    metas.meta_receita,
        meta_clientes:   metas.meta_clientes,
        meta_contatos:   metas.meta_contatos,
        custo_marketing: metas.custo_marketing,
      });
    }
  }, [open, metas]);

  const save = useMutation({
    mutationFn: () => upsertOrgGoal({
      year: metas.mes_ano.year, month: metas.mes_ano.month,
      meta_receita:    Number(form.meta_receita)    || 0,
      meta_clientes:   Number(form.meta_clientes)   || 0,
      meta_contatos:   Number(form.meta_contatos)   || 0,
      custo_marketing: Number(form.custo_marketing) || 0,
    }),
    onSuccess: () => {
      toast.success("Metas atualizadas");
      qc.invalidateQueries({ queryKey: ["dashboard", "v7"] });
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Target className="mr-1 h-3 w-3" /> Definir metas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Metas — {String(metas.mes_ano.month).padStart(2,"0")}/{metas.mes_ano.year}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mr" className="text-xs">Meta de receita (R$)</Label>
            <Input id="mr" type="number" step="0.01" value={form.meta_receita}
              onChange={(e) => setForm({ ...form, meta_receita: Number(e.target.value) })}/>
          </div>
          <div>
            <Label htmlFor="mc" className="text-xs">Meta de clientes</Label>
            <Input id="mc" type="number" value={form.meta_clientes}
              onChange={(e) => setForm({ ...form, meta_clientes: Number(e.target.value) })}/>
          </div>
          <div>
            <Label htmlFor="mcn" className="text-xs">Meta de contatos</Label>
            <Input id="mcn" type="number" value={form.meta_contatos}
              onChange={(e) => setForm({ ...form, meta_contatos: Number(e.target.value) })}/>
          </div>
          <div>
            <Label htmlFor="cm" className="text-xs">Custo marketing (R$)</Label>
            <Input id="cm" type="number" step="0.01" value={form.custo_marketing}
              onChange={(e) => setForm({ ...form, custo_marketing: Number(e.target.value) })}/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}