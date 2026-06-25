import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { ClienteFormDialog } from "@/modules/operacoes/components/ClienteFormDialog";
import { deleteCliente, listClientes } from "@/modules/operacoes/api";
import { OP_CLIENTE_STATUS_LABEL, type OpCliente } from "@/modules/operacoes/types";

export const Route = createFileRoute("/operacoes/clientes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Clientes — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Clientes">
        <ClientesPage />
      </AppShell>
    </RequireAuth>
  ),
});

const STATUS_STYLES: Record<string, string> = {
  ativo: "bg-emerald-500/15 text-emerald-400",
  pausado: "bg-amber-500/15 text-amber-400",
  offboarding: "bg-orange-500/15 text-orange-400",
  encerrado: "bg-muted text-muted-foreground",
};

function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<OpCliente | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return q.data ?? [];
    return (q.data ?? []).filter((c) =>
      [c.nome, c.empresa, c.email, c.telefone, c.whatsapp]
        .map((v) => (v ?? "").toLowerCase())
        .some((v) => v.includes(s)),
    );
  }, [q.data, search]);

  const delM = useMutation({
    mutationFn: (id: string) => deleteCliente(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-clientes"] });
      qc.invalidateQueries({ queryKey: ["op-dashboard"] });
      toast.success("Cliente removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <OperacoesLayout description="Cadastro centralizado dos clientes da operação. Vincule contas de tráfego, entregas e métricas.">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por nome, empresa, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Contato</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border/60 hover:bg-background/30">
                  <td className="px-3 py-2 font-medium text-foreground">{c.nome}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.empresa ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <div>{c.email ?? "—"}</div>
                    <div className="text-[11px]">{c.whatsapp ?? c.telefone ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[c.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {OP_CLIENTE_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        if (confirm(`Remover ${c.nome}?`)) delM.mutate(c.id);
                      }}
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

      <ClienteFormDialog open={creating} onOpenChange={setCreating} />
      <ClienteFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        cliente={editing}
      />
    </OperacoesLayout>
  );
}