import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient, listClients } from "@/modules/lifecycle/api";
import { STAGE_LABEL, STAGE_TONE } from "@/modules/lifecycle/types";

export const Route = createFileRoute("/clients")({
  ssr: false,
  head: () => ({ meta: [{ title: "Clientes 360 — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Clientes" subtitle="Visão 360 do ciclo de vida">
        <ClientsListPage />
      </AppShell>
    </RequireAuth>
  ),
});

function ClientsListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company: "", contact_name: "", phone: "", email: "" });

  const q = useQuery({ queryKey: ["lc-clients"], queryFn: () => listClients() });

  const createM = useMutation({
    mutationFn: () => createClient(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lc-clients"] });
      toast.success("Cliente criado");
      setForm({ company: "", contact_name: "", phone: "", email: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (q.data ?? []).filter((c) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [c.company, c.contact_name, c.email, c.phone].some((v) => (v ?? "").toLowerCase().includes(s));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por empresa, contato, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="ml-auto" />
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link key={c.id} to="/clients/$id" params={{ id: c.id }}>
            <Card className="p-4 transition hover:bg-accent/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.company}</p>
                  {c.contact_name && (
                    <p className="truncate text-xs text-muted-foreground">{c.contact_name}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${STAGE_TONE[c.pipeline_stage]}`}
                >
                  {STAGE_LABEL[c.pipeline_stage]}
                </span>
              </div>
              {c.operations_locked && c.pipeline_stage !== "ATIVO" && (
                <p className="mt-2 text-[11px] text-amber-400">🔒 Operações bloqueadas</p>
              )}
            </Card>
          </Link>
        ))}
        {!q.isLoading && filtered.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Empresa *"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
            <Input
              placeholder="Responsável"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
            <Input
              placeholder="Telefone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!form.company.trim() || createM.isPending}
              onClick={() => createM.mutate()}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}