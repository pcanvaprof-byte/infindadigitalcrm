import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { listClientes } from "@/modules/operacoes/api";
import {
  deleteRenewal, listRenewals, upsertRenewal,
} from "@/modules/operacoes/fase2.api";
import type {
  OpContractRenewal, OpRenewalComputedStatus, OpRenewalStoredStatus, OpRenewalView,
} from "@/modules/operacoes/fase2.types";

export const Route = createFileRoute("/operacoes/renovacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Renovações — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Renovações">
        <RenovacoesPage />
      </AppShell>
    </RequireAuth>
  ),
});

const STATUS_STYLES: Record<OpRenewalComputedStatus, string> = {
  "Ativo": "bg-emerald-500/15 text-emerald-400",
  "Próximo Vencimento": "bg-amber-500/15 text-amber-400",
  "Urgente": "bg-orange-500/15 text-orange-400",
  "Vencido": "bg-red-500/15 text-red-400",
  "Renovado": "bg-sky-500/15 text-sky-400",
  "Cancelado": "bg-muted text-muted-foreground",
};

function RenovacoesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<OpRenewalView | null>(null);
  const [creating, setCreating] = useState(false);

  const clientesQ = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });
  const ren = useQuery({ queryKey: ["op-renewals"], queryFn: listRenewals });

  const clienteName = (id: string) => clientesQ.data?.find((c) => c.id === id)?.nome ?? "—";

  const counters = (ren.data ?? []).reduce(
    (a, r) => ({ ...a, [r.computed_status]: (a[r.computed_status] ?? 0) + 1 }),
    {} as Record<OpRenewalComputedStatus, number>,
  );

  const delM = useMutation({
    mutationFn: (id: string) => deleteRenewal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-renewals"] });
      qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
      toast.success("Renovação removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <OperacoesLayout description="Vencimentos e renovações de contratos por cliente. Alertas calculados em tempo real.">
      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard label="Ativos" value={counters["Ativo"] ?? 0} />
        <KpiCard label="Próx. Vencimento" value={counters["Próximo Vencimento"] ?? 0} />
        <KpiCard label="Urgentes" value={counters["Urgente"] ?? 0} />
        <KpiCard label="Vencidos" value={counters["Vencido"] ?? 0} />
      </div>

      <div className="mb-3 flex items-center justify-end">
        <Button onClick={() => setCreating(true)} disabled={!clientesQ.data?.length}>
          <Plus className="mr-2 h-4 w-4" /> Novo contrato
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Início</th>
                <th className="px-3 py-2 text-left">Fim</th>
                <th className="px-3 py-2 text-right">Dias</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ren.isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!ren.isLoading && (ren.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum contrato cadastrado.</td></tr>
              )}
              {(ren.data ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-background/30">
                  <td className="px-3 py-2 font-medium text-foreground">{clienteName(r.client_id)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.contract_start ? new Date(r.contract_start + "T00:00").toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.contract_end + "T00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {r.days_to_expire >= 0 ? `${r.days_to_expire}d` : `${Math.abs(r.days_to_expire)}d atrás`}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[r.computed_status]}`}>
                      {r.computed_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm("Remover contrato?")) delM.mutate(r.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <RenewalDialog
        open={creating || !!editing}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
        renewal={editing}
        clientes={clientesQ.data ?? []}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["op-renewals"] });
          qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
        }}
      />
    </OperacoesLayout>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </Card>
  );
}

function RenewalDialog({
  open, onOpenChange, renewal, clientes, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  renewal: OpRenewalView | null;
  clientes: { id: string; nome: string }[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    client_id: "", contract_start: "", contract_end: "",
    renewal_status: "ativo" as OpRenewalStoredStatus,
    notes: "",
  });
  useEffect(() => {
    if (renewal) {
      setForm({
        client_id: renewal.client_id,
        contract_start: renewal.contract_start ?? "",
        contract_end: renewal.contract_end,
        renewal_status: renewal.renewal_status,
        notes: renewal.notes ?? "",
      });
    } else if (open) {
      setForm({ client_id: "", contract_start: "", contract_end: "", renewal_status: "ativo", notes: "" });
    }
  }, [renewal, open]);

  const m = useMutation({
    mutationFn: () => upsertRenewal({
      id: renewal?.id as OpContractRenewal["id"] | undefined,
      ...form,
    }),
    onSuccess: () => {
      toast.success(renewal ? "Renovação atualizada" : "Contrato cadastrado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{renewal ? "Editar contrato" : "Novo contrato"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Cliente *</label>
            <Select value={form.client_id || undefined} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))} disabled={!!renewal}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Início</label>
              <Input type="date" value={form.contract_start} onChange={(e) => setForm((f) => ({ ...f, contract_start: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fim *</label>
              <Input type="date" value={form.contract_end} onChange={(e) => setForm((f) => ({ ...f, contract_end: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={form.renewal_status} onValueChange={(v) => setForm((f) => ({ ...f, renewal_status: v as OpRenewalStoredStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="renovado">Renovado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.client_id || !form.contract_end}>
            {m.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}