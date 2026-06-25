import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  createDeployment, deleteDeployment, listDeployments, updateDeployment,
} from "@/modules/operacoes/fase2.api";
import {
  OP_DEPLOYMENT_CATEGORIES, OP_DEPLOYMENT_PRIORITIES, OP_DEPLOYMENT_STATUS_LABEL,
  type OpDeployment, type OpDeploymentCategory, type OpDeploymentPriority,
  type OpDeploymentStatus,
} from "@/modules/operacoes/fase2.types";

export const Route = createFileRoute("/operacoes/implantacao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Implantação — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Implantação">
        <ImplantacaoPage />
      </AppShell>
    </RequireAuth>
  ),
});

const PRIORITY_STYLES: Record<OpDeploymentPriority, string> = {
  "Baixa": "bg-muted text-muted-foreground",
  "Normal": "bg-sky-500/15 text-sky-400",
  "Alta": "bg-amber-500/15 text-amber-400",
  "Crítica": "bg-red-500/15 text-red-400",
};
const STATUS_STYLES: Record<OpDeploymentStatus, string> = {
  nao_iniciado: "bg-muted text-muted-foreground",
  em_andamento: "bg-sky-500/15 text-sky-400",
  aguardando_aprovacao: "bg-amber-500/15 text-amber-400",
  concluido: "bg-emerald-500/15 text-emerald-400",
};

function ImplantacaoPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [category, setCategory] = useState<OpDeploymentCategory | "">("");
  const [status, setStatus] = useState<OpDeploymentStatus | "">("");
  const [priority, setPriority] = useState<OpDeploymentPriority | "">("");
  const [editing, setEditing] = useState<OpDeployment | null>(null);
  const [creating, setCreating] = useState(false);

  const clientesQ = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });
  const depQ = useQuery({
    queryKey: ["op-deployments", { clientId, category, status, priority, search }],
    queryFn: () => listDeployments({
      clientId: clientId || undefined,
      category: (category || undefined) as OpDeploymentCategory | undefined,
      status: (status || undefined) as OpDeploymentStatus | undefined,
      priority: (priority || undefined) as OpDeploymentPriority | undefined,
      search: search || undefined,
    }),
  });

  const clienteName = (id: string) => clientesQ.data?.find((c) => c.id === id)?.nome ?? "—";

  const progressByClient = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    (depQ.data ?? []).forEach((d) => {
      const cur = m.get(d.client_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (d.status === "concluido") cur.done += 1;
      m.set(d.client_id, cur);
    });
    return m;
  }, [depQ.data]);

  const delM = useMutation({
    mutationFn: (id: string) => deleteDeployment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-deployments"] });
      qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
      toast.success("Tarefa removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <OperacoesLayout description="Tarefas de implantação por cliente — Pixel, CAPI, Analytics, GTM, LP, anúncios e automações.">
      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
        <Input
          placeholder="Buscar título…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="col-span-2"
        />
        <SelectFilter
          value={clientId} onChange={setClientId}
          placeholder="Cliente"
          options={[{ value: "", label: "Todos clientes" }, ...(clientesQ.data ?? []).map((c) => ({ value: c.id, label: c.nome }))]}
        />
        <SelectFilter
          value={category} onChange={(v) => setCategory(v as OpDeploymentCategory | "")}
          placeholder="Categoria"
          options={[{ value: "", label: "Todas categorias" }, ...OP_DEPLOYMENT_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <SelectFilter
          value={status} onChange={(v) => setStatus(v as OpDeploymentStatus | "")}
          placeholder="Status"
          options={[{ value: "", label: "Todos status" }, ...Object.entries(OP_DEPLOYMENT_STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))]}
        />
        <SelectFilter
          value={priority} onChange={(v) => setPriority(v as OpDeploymentPriority | "")}
          placeholder="Prioridade"
          options={[{ value: "", label: "Todas prioridades" }, ...OP_DEPLOYMENT_PRIORITIES.map((p) => ({ value: p, label: p }))]}
        />
      </div>
      <div className="mb-3 flex items-center justify-end">
        <Button onClick={() => setCreating(true)} disabled={!clientesQ.data?.length}>
          <Plus className="mr-2 h-4 w-4" /> Nova tarefa
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Título</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-left">Prioridade</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Prazo</th>
                <th className="px-3 py-2 text-left">Progresso (cliente)</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {depQ.isLoading && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!depQ.isLoading && (depQ.data ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhuma tarefa.</td></tr>
              )}
              {(depQ.data ?? []).map((d) => {
                const p = progressByClient.get(d.client_id) ?? { done: 0, total: 1 };
                return (
                  <tr key={d.id} className="border-t border-border/60 hover:bg-background/30">
                    <td className="px-3 py-2 font-medium text-foreground">{d.title}</td>
                    <td className="px-3 py-2 text-muted-foreground">{clienteName(d.client_id)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.category}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${PRIORITY_STYLES[d.priority]}`}>{d.priority}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[d.status]}`}>
                        {OP_DEPLOYMENT_STATUS_LABEL[d.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      {d.due_date ? new Date(d.due_date + "T00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      {p.done}/{p.total}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => { if (confirm("Remover tarefa?")) delM.mutate(d.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <DeploymentDialog
        open={creating || !!editing}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
        deployment={editing}
        clientes={clientesQ.data ?? []}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["op-deployments"] });
          qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
        }}
      />
    </OperacoesLayout>
  );
}

function SelectFilter({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || "__all"} value={o.value || "__all"}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DeploymentDialog({
  open, onOpenChange, deployment, clientes, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deployment: OpDeployment | null;
  clientes: { id: string; nome: string }[];
  onSaved: () => void;
}) {
  const empty = {
    client_id: "", title: "", description: "",
    category: "Pixel" as OpDeploymentCategory,
    status: "nao_iniciado" as OpDeploymentStatus,
    priority: "Normal" as OpDeploymentPriority,
    due_date: "",
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (deployment) {
      setForm({
        client_id: deployment.client_id,
        title: deployment.title,
        description: deployment.description ?? "",
        category: deployment.category,
        status: deployment.status,
        priority: deployment.priority,
        due_date: deployment.due_date ?? "",
      });
    } else if (open) setForm(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment, open]);

  const m = useMutation({
    mutationFn: () => deployment
      ? updateDeployment(deployment.id, form)
      : createDeployment(form),
    onSuccess: () => {
      toast.success(deployment ? "Tarefa atualizada" : "Tarefa criada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{deployment ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Cliente *</label>
            <Select
              value={form.client_id || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
              disabled={!!deployment}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Título *</label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as OpDeploymentCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OP_DEPLOYMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prioridade</label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as OpDeploymentPriority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OP_DEPLOYMENT_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as OpDeploymentStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OP_DEPLOYMENT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prazo</label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.client_id || !form.title.trim()}>
            {m.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}