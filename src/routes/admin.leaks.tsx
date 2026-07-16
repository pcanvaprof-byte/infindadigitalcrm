import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/leaks")({
  head: () => ({ meta: [{ title: "Alertas de vazamento — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
        <LeaksPage />
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
});

type AlertRow = {
  id: string;
  organization_id: string;
  leak_count: number;
  sample_ids: string[];
  status: string;
  checked_at: string;
  resolved_at: string | null;
  notes: string | null;
  organization?: { name: string | null } | null;
};

function statusBadge(status: string) {
  if (status === "corrigido") return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Corrigido</Badge>;
  if (status === "ignorado") return <Badge variant="outline">Ignorado</Badge>;
  return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Pendente</Badge>;
}

function LeaksPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pendente" | "todos">("pendente");

  const q = useQuery({
    queryKey: ["prospects-private-leak-alerts", filter],
    queryFn: async (): Promise<AlertRow[]> => {
      let query = supabase
        .from("prospects_private_leak_alerts")
        .select("id, organization_id, leak_count, sample_ids, status, checked_at, resolved_at, notes, organization:organizations(name)")
        .order("checked_at", { ascending: false })
        .limit(200);
      if (filter === "pendente") query = query.eq("status", "pendente");
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AlertRow[];
    },
  });

  const scanMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("check_prospects_private_leaks", {});
      if (error) throw error;
      return data;
    },
    onSuccess: (rows) => {
      const total = Array.isArray(rows) ? rows.reduce((s: number, r: any) => s + Number(r.out_leak_count ?? 0), 0) : 0;
      toast.success(total > 0 ? `Scan concluído: ${total} vazamento(s) encontrado(s).` : "Scan concluído: nenhum vazamento encontrado.");
      qc.invalidateQueries({ queryKey: ["prospects-private-leak-alerts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const fixMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("fix_prospects_private_leaks", { _alert_id: id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (fixed) => {
      toast.success(`Corrigido: ${fixed ?? 0} linha(s) normalizada(s).`);
      qc.invalidateQueries({ queryKey: ["prospects-private-leak-alerts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = q.data ?? [];
  const summary = useMemo(() => {
    const byOrg = new Map<string, { org: string; name: string; pendente: number; corrigido: number; ignorado: number; total: number }>();
    for (const r of rows) {
      const key = r.organization_id;
      const cur = byOrg.get(key) ?? { org: key, name: r.organization?.name ?? key, pendente: 0, corrigido: 0, ignorado: 0, total: 0 };
      cur.total += r.leak_count;
      if (r.status === "pendente") cur.pendente += r.leak_count;
      else if (r.status === "corrigido") cur.corrigido += r.leak_count;
      else if (r.status === "ignorado") cur.ignorado += r.leak_count;
      byOrg.set(key, cur);
    }
    return Array.from(byOrg.values()).sort((a, b) => b.pendente - a.pendente);
  }, [rows]);

  const totalPendente = summary.reduce((s, r) => s + r.pendente, 0);

  return (
    <AppShell title="Alertas de vazamento de dados privados">
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Vazamentos em <code className="text-base">prospects</code>
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Monitora colunas privadas (status, cadência, contatos, fechamento) que estejam fora do default na visão compartilhada.
              Rode o scan sob demanda e corrija diretamente por alerta — o trigger normaliza os campos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${q.isFetching ? "animate-spin" : ""}`} /> Recarregar
            </Button>
            <Button onClick={() => scanMut.mutate()} disabled={scanMut.isPending}>
              {scanMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Rodar scan agora
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Alertas pendentes</div>
            <div className="text-2xl font-semibold mt-1">{rows.filter(r => r.status === "pendente").length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Linhas com vazamento (pendente)</div>
            <div className="text-2xl font-semibold mt-1">{totalPendente}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Organizações afetadas</div>
            <div className="text-2xl font-semibold mt-1">{summary.filter(s => s.pendente > 0).length}</div>
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Contagem por organização</h2>
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Corrigido</TableHead>
                  <TableHead className="text-right">Ignorado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => (
                  <TableRow key={s.org}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.pendente > 0 ? <span className="text-destructive font-semibold">{s.pendente}</span> : 0}</TableCell>
                    <TableCell className="text-right">{s.corrigido}</TableCell>
                    <TableCell className="text-right">{s.ignorado}</TableCell>
                    <TableCell className="text-right">{s.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Alertas</h2>
            <div className="flex gap-2 text-xs">
              <Button size="sm" variant={filter === "pendente" ? "default" : "outline"} onClick={() => setFilter("pendente")}>Pendentes</Button>
              <Button size="sm" variant={filter === "todos" ? "default" : "outline"} onClick={() => setFilter("todos")}>Todos</Button>
            </div>
          </div>
          {q.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta {filter === "pendente" ? "pendente" : "registrado"}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Detectado em</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amostras</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.organization?.name ?? r.organization_id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(r.checked_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-semibold">{r.leak_count}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate" title={r.sample_ids.join(", ")}>
                      {r.sample_ids.slice(0, 3).join(", ")}{r.sample_ids.length > 3 ? `… (+${r.sample_ids.length - 3})` : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pendente" ? (
                        <Button
                          size="sm"
                          onClick={() => fixMut.mutate(r.id)}
                          disabled={fixMut.isPending && fixMut.variables === r.id}
                        >
                          {fixMut.isPending && fixMut.variables === r.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : null}
                          Corrigir agora
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.resolved_at ? new Date(r.resolved_at).toLocaleString("pt-BR") : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}