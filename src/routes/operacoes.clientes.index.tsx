import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Trash2, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { ClienteFormDialog } from "@/modules/operacoes/components/ClienteFormDialog";
import { deleteCliente, importClientesFromContratos, listClientes } from "@/modules/operacoes/api";
import { OP_CLIENTE_STATUS_LABEL, type OpCliente } from "@/modules/operacoes/types";
import { createClient as createLifecycleClient, listClients as listLifecycleClients } from "@/modules/lifecycle/api";
import { pushLifecycleLog } from "@/lib/lifecycle/audit-log";
import { supabase } from "@/integrations/supabase/client";
import { STAGE_LABEL, STAGE_TONE } from "@/modules/lifecycle/types";

export const Route = createFileRoute("/operacoes/clientes/")({
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
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });
  const lc = useQuery({ queryKey: ["lc-clients"], queryFn: () => listLifecycleClients() });

  // mapa source_ref(op_cliente.id) -> lifecycle client (para estágio + link 360)
  const lcBySource = useMemo(() => {
    const m = new Map<string, { id: string; stage: keyof typeof STAGE_LABEL; locked: boolean }>();
    for (const c of lc.data ?? []) {
      if (c.created_from === "operacoes" && c.source_ref) {
        m.set(c.source_ref, { id: c.id, stage: c.pipeline_stage, locked: c.operations_locked });
      }
    }
    return m;
  }, [lc.data]);

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

  const importM = useMutation({
    mutationFn: () => importClientesFromContratos(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["op-clientes"] });
      qc.invalidateQueries({ queryKey: ["op-dashboard"] });
      if (r.importados === 0) {
        toast.info(`Nenhum novo cliente. ${r.ignorados} já estavam cadastrados.`);
      } else {
        toast.success(`${r.importados} cliente(s) importado(s) de contratos. ${r.ignorados} ignorado(s).`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openClient(c: OpCliente) {
    const trace = (step: string, payload?: Record<string, unknown>) =>
      pushLifecycleLog(step, { op_cliente_id: c.id, nome: c.nome, empresa: c.empresa, ...payload });
    try {
      setOpening(c.id);
      trace("open:start");
      // 1) já vinculado por source_ref?
      const linked = lcBySource.get(c.id);
      if (linked) {
        trace("open:match-source_ref", { lc_id: linked.id, stage: linked.stage });
        navigate({ to: "/operacoes/clientes/$id", params: { id: linked.id } });
        return;
      }
      const db = supabase as unknown as { from: (t: string) => any };
      // 2) tenta achar um lifecycle existente pelo mesmo nome/empresa
      //    (ex.: criado por importação de contratos) e vincula
      const company = (c.empresa || c.nome || "").trim();
      let lcId: string | null = null;
      if (company) {
        const { data: matches } = await db
          .from("clients")
          .select("id, source_ref")
          .ilike("company", company)
          .limit(1);
        if (matches && matches.length > 0) {
          lcId = matches[0].id as string;
          if (matches[0].source_ref !== c.id) {
            await db
              .from("clients")
              .update({ source_ref: c.id, created_from: "operacoes" })
              .eq("id", lcId);
            trace("open:repair-source_ref", { lc_id: lcId, previous_source_ref: matches[0].source_ref ?? null });
            toast.success("Vínculo do cliente reparado");
          } else {
            trace("open:match-company", { lc_id: lcId });
          }
        }
      }
      // 3) caso contrário, cria um novo já vinculado
      if (!lcId) {
        const lc = await createLifecycleClient({
        company: c.empresa || c.nome,
        contact_name: c.nome,
        email: c.email ?? undefined,
        phone: c.telefone ?? c.whatsapp ?? undefined,
      });
        await db
          .from("clients")
          .update({ created_from: "operacoes", source_ref: c.id })
          .eq("id", lc.id);
        lcId = lc.id;
        trace("open:created", { lc_id: lcId });
        toast.success("Ficha 360 criada para este cliente");
      }
      qc.invalidateQueries({ queryKey: ["lc-clients"] });
      trace("open:navigate", { lc_id: lcId });
      navigate({ to: "/operacoes/clientes/$id", params: { id: lcId } });
    } catch (e) {
      pushLifecycleLog("open:error", {
        op_cliente_id: c.id,
        nome: c.nome,
        empresa: c.empresa,
        error: (e as Error)?.message ?? String(e),
      });
      toast.error((e as Error).message);
    } finally {
      setOpening(null);
    }
  }

  return (
    <OperacoesLayout description="Cadastro centralizado dos clientes da operação. Vincule contas de tráfego, entregas e métricas.">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por nome, empresa, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link to="/operacoes/auditoria-lifecycle">
              <FileSearch className="mr-2 h-4 w-4" />
              Auditoria
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => importM.mutate()}
            disabled={importM.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            {importM.isPending ? "Importando…" : "Importar de Contratos"}
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Contato</th>
                <th className="px-3 py-2 text-left">Estágio</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const lcRef = lcBySource.get(c.id);
                const NameCell = (
                  <button
                    type="button"
                    onClick={() => openClient(c)}
                    disabled={opening === c.id}
                    className="text-left font-medium text-primary hover:underline disabled:opacity-60"
                  >
                    {c.nome}
                    {opening === c.id ? " …" : ""}
                  </button>
                );
                return (
                <tr
                  key={c.id}
                  className="cursor-pointer border-t border-border/60 hover:bg-background/30"
                  onClick={() => openClient(c)}
                >
                  <td className="px-3 py-2">{NameCell}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.empresa ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <div>{c.email ?? "—"}</div>
                    <div className="text-[11px]">{c.whatsapp ?? c.telefone ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    {lcRef ? (
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${STAGE_TONE[lcRef.stage]}`}>
                        {STAGE_LABEL[lcRef.stage]}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[c.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {OP_CLIENTE_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ClienteFormDialog open={creating} onOpenChange={setCreating} />
    </OperacoesLayout>
  );
}