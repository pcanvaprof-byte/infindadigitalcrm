import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { CampanhaFormDialog } from "@/modules/operacoes/components/CampanhaFormDialog";
import { deleteCampanha, listCampanhas, listClientes } from "@/modules/operacoes/api";
import { OP_PLATAFORMA_LABEL, type OpTrafegoCampanha } from "@/modules/operacoes/types";

export const Route = createFileRoute("/operacoes/trafego")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Tráfego — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Tráfego pago">
        <TrafegoPage />
      </AppShell>
    </RequireAuth>
  ),
});

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function TrafegoPage() {
  const qc = useQueryClient();
  const [clienteFilter, setClienteFilter] = useState<string>("__all");
  const [editing, setEditing] = useState<OpTrafegoCampanha | null>(null);
  const [creating, setCreating] = useState(false);

  const clientesQ = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });
  const camQ = useQuery({ queryKey: ["op-campanhas"], queryFn: () => listCampanhas() });

  const filtered = useMemo(() => {
    const all = camQ.data ?? [];
    if (clienteFilter === "__all") return all;
    return all.filter((c) => c.cliente_id === clienteFilter);
  }, [camQ.data, clienteFilter]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, c) => {
        acc.verba += Number(c.verba || 0);
        acc.gasto += Number(c.gasto || 0);
        acc.conversoes += Number(c.conversoes || 0);
        return acc;
      },
      { verba: 0, gasto: 0, conversoes: 0 },
    );
  }, [filtered]);

  const delM = useMutation({
    mutationFn: (id: string) => deleteCampanha(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-campanhas"] });
      qc.invalidateQueries({ queryKey: ["op-dashboard"] });
      toast.success("Campanha removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clienteNome = (id: string) =>
    clientesQ.data?.find((c) => c.id === id)?.nome ?? "—";

  return (
    <OperacoesLayout description="Centralize campanhas de Meta, Google, TikTok e LinkedIn Ads. Acompanhe verba, gasto, conversões, CPA e ROAS.">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={clienteFilter} onValueChange={setClienteFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os clientes</SelectItem>
              {(clientesQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreating(true)} disabled={(clientesQ.data ?? []).length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Nova campanha
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Verba</div>
          <div className="text-lg font-semibold">{fmtMoney(totals.verba)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Gasto</div>
          <div className="text-lg font-semibold">{fmtMoney(totals.gasto)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Conversões
          </div>
          <div className="text-lg font-semibold">{totals.conversoes}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Campanha</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Plataforma</th>
                <th className="px-3 py-2 text-right">Verba</th>
                <th className="px-3 py-2 text-right">Gasto</th>
                <th className="px-3 py-2 text-right">Conv.</th>
                <th className="px-3 py-2 text-right">CPA</th>
                <th className="px-3 py-2 text-right">ROAS</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {camQ.isLoading && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!camQ.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma campanha cadastrada.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border/60 hover:bg-background/30">
                  <td className="px-3 py-2 font-medium text-foreground">{c.nome}</td>
                  <td className="px-3 py-2 text-muted-foreground">{clienteNome(c.cliente_id)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {OP_PLATAFORMA_LABEL[c.plataforma]}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtMoney(Number(c.verba))}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(Number(c.gasto))}</td>
                  <td className="px-3 py-2 text-right">{c.conversoes}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(Number(c.cpa))}</td>
                  <td className="px-3 py-2 text-right">{Number(c.roas).toFixed(2)}x</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        if (confirm("Remover esta campanha?")) delM.mutate(c.id);
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

      <CampanhaFormDialog
        open={creating}
        onOpenChange={setCreating}
        clientes={clientesQ.data ?? []}
        defaultClienteId={clienteFilter !== "__all" ? clienteFilter : null}
      />
      <CampanhaFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        clientes={clientesQ.data ?? []}
        campanha={editing}
      />
    </OperacoesLayout>
  );
}