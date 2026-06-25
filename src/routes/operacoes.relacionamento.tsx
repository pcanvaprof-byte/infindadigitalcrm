import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
  createInteraction, deleteInteraction, listInteractions,
  listPendingFollowups,
} from "@/modules/operacoes/fase2.api";
import { OP_INTERACTION_TYPES, type OpInteractionType } from "@/modules/operacoes/fase2.types";

export const Route = createFileRoute("/operacoes/relacionamento")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Relacionamento — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Relacionamento">
        <RelacionamentoPage />
      </AppShell>
    </RequireAuth>
  ),
});

function RelacionamentoPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<OpInteractionType | "">("");
  const [creating, setCreating] = useState(false);

  const clientesQ = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });
  const itQ = useQuery({
    queryKey: ["op-interactions", { clientId }],
    queryFn: () => listInteractions(clientId || undefined),
  });
  const fuQ = useQuery({ queryKey: ["op-followups"], queryFn: listPendingFollowups });

  const clienteName = (id: string) => clientesQ.data?.find((c) => c.id === id)?.nome ?? "—";

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (itQ.data ?? []).filter((i) => {
      if (type && i.interaction_type !== type) return false;
      if (!s) return true;
      return (i.title + " " + (i.notes ?? "") + " " + clienteName(i.client_id))
        .toLowerCase().includes(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itQ.data, type, search, clientesQ.data]);

  const now = Date.now();
  const pendingDue = (fuQ.data ?? []).filter(
    (i) => i.next_followup_at && new Date(i.next_followup_at).getTime() <= now + 14 * 24 * 3600 * 1000,
  );

  const delM = useMutation({
    mutationFn: (id: string) => deleteInteraction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-interactions"] });
      qc.invalidateQueries({ queryKey: ["op-followups"] });
      qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
      toast.success("Interação removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <OperacoesLayout description="Timeline de contatos, reuniões, suporte e solicitações por cliente.">
      <div className="mb-3 grid gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Follow-ups pendentes (14 dias)</div>
            <span className="text-[11px] text-muted-foreground">{pendingDue.length}</span>
          </div>
          {pendingDue.length === 0 && (
            <p className="text-sm text-muted-foreground">Nada pendente.</p>
          )}
          <ul className="space-y-2">
            {pendingDue.slice(0, 6).map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-sm">
                <span className="truncate">
                  <strong>{clienteName(i.client_id)}</strong> — {i.title}
                </span>
                <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                  {i.next_followup_at ? new Date(i.next_followup_at).toLocaleString("pt-BR") : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total interações</div>
          <div className="mt-1 text-2xl font-semibold">{itQ.data?.length ?? 0}</div>
          <Button className="mt-3 w-full" onClick={() => setCreating(true)} disabled={!clientesQ.data?.length}>
            <Plus className="mr-2 h-4 w-4" /> Nova interação
          </Button>
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={clientId || "__all"} onValueChange={(v) => setClientId(v === "__all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos clientes</SelectItem>
            {(clientesQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type || "__all"} onValueChange={(v) => setType(v === "__all" ? "" : v as OpInteractionType)}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos tipos</SelectItem>
            {OP_INTERACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border/60">
          {itQ.isLoading && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Carregando…</li>}
          {!itQ.isLoading && filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma interação.</li>
          )}
          {filtered.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-3 hover:bg-background/30">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary-glow">
                    {i.interaction_type}
                  </span>
                  {i.title}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {clienteName(i.client_id)} · {new Date(i.interaction_date).toLocaleString("pt-BR")}
                  {i.next_followup_at && (
                    <> · próximo: {new Date(i.next_followup_at).toLocaleString("pt-BR")}</>
                  )}
                </div>
                {i.notes && <p className="mt-1 text-xs text-muted-foreground">{i.notes}</p>}
              </div>
              <Button
                size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                onClick={() => { if (confirm("Remover interação?")) delM.mutate(i.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <InteractionDialog
        open={creating}
        onOpenChange={setCreating}
        clientes={clientesQ.data ?? []}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["op-interactions"] });
          qc.invalidateQueries({ queryKey: ["op-followups"] });
          qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
        }}
      />
    </OperacoesLayout>
  );
}

function InteractionDialog({
  open, onOpenChange, clientes, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientes: { id: string; nome: string }[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    client_id: "",
    interaction_type: "WhatsApp" as OpInteractionType,
    title: "",
    notes: "",
    interaction_date: new Date().toISOString().slice(0, 16),
    next_followup_at: "",
  });

  const m = useMutation({
    mutationFn: () => createInteraction({
      client_id: form.client_id,
      interaction_type: form.interaction_type,
      title: form.title,
      notes: form.notes,
      interaction_date: new Date(form.interaction_date).toISOString(),
      next_followup_at: form.next_followup_at ? new Date(form.next_followup_at).toISOString() : null,
    }),
    onSuccess: () => {
      toast.success("Interação registrada");
      setForm((f) => ({ ...f, title: "", notes: "", next_followup_at: "" }));
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova interação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Cliente *</label>
              <Select value={form.client_id || undefined} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={form.interaction_type} onValueChange={(v) => setForm((f) => ({ ...f, interaction_type: v as OpInteractionType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OP_INTERACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Título *</label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Data</label>
              <Input type="datetime-local" value={form.interaction_date} onChange={(e) => setForm((f) => ({ ...f, interaction_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Próximo follow-up</label>
              <Input type="datetime-local" value={form.next_followup_at} onChange={(e) => setForm((f) => ({ ...f, next_followup_at: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.client_id || !form.title.trim()}>
            {m.isPending ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}