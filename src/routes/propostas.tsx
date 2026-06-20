import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  listProposals, propostasKeys,
  createProposalFromDeal, createProposalFromProspect,
} from "@/lib/propostas/api";
import {
  biKeys, fetchProposalKPIs, fetchProposalConversion,
} from "@/lib/propostas/bi";
import {
  PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_TONE, type ProposalStatus,
} from "@/lib/propostas/types";
import { listDeals } from "@/lib/crm/api";
import { formatBRL } from "@/lib/catalog/types";
import { FileText, Plus, Search, TrendingUp, Eye, CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/propostas")({
  head: () => ({ meta: [{ title: "Propostas — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <PropostasPage />
    </RequireAuth>
  ),
});

function PropostasPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "todos">("todos");
  const [newOpen, setNewOpen] = useState(false);

  const q = useQuery({ queryKey: propostasKeys.all, queryFn: listProposals });
  const propostas = q.data ?? [];
  // BI vem do DB (vw_*). Frontend NÃO recalcula KPIs — Etapa 6 / EBD.
  const kpisQ  = useQuery({ queryKey: biKeys.kpis,       queryFn: fetchProposalKPIs });
  const convQ  = useQuery({ queryKey: biKeys.conversion, queryFn: fetchProposalConversion });
  const stats  = kpisQ.data ?? {
    total: 0, rascunho: 0, enviadas: 0, visualizadas: 0, aprovadas: 0,
    rejeitadas: 0, expiradas: 0, valor_total_enviado: 0,
    valor_total_aprovado: 0, valor_perdido: 0, ticket_medio: 0, taxa_aprovacao: 0,
  };
  const conv = convQ.data ?? {
    enviadas: 0, visualizadas: 0, decididas: 0,
    tempo_medio_visualizacao_h: 0, tempo_medio_decisao_h: 0,
  };

  const filtered = useMemo(() => {
    return propostas.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        p.numero?.toLowerCase().includes(q) ||
        p.titulo?.toLowerCase().includes(q)
      );
    });
  }, [propostas, query, statusFilter]);

  const kpis = [
    { label: "Total", value: stats.total.toString(), icon: FileText },
    { label: "Enviadas", value: stats.enviadas.toString(), icon: TrendingUp },
    { label: "Visualizadas", value: stats.visualizadas.toString(), icon: Eye },
    { label: "Aprovadas", value: stats.aprovadas.toString(), icon: CheckCircle2 },
    { label: "Rejeitadas", value: stats.rejeitadas.toString(), icon: XCircle },
    { label: "Expiradas", value: stats.expiradas.toString(), icon: Clock },
  ];

  const moneyKpis = [
    { label: "Ticket médio", value: formatBRL(stats.ticket_medio) },
    { label: "Valor enviado (12m)", value: formatBRL(stats.valor_total_enviado) },
    { label: "Valor aprovado (12m)", value: formatBRL(stats.valor_total_aprovado) },
    { label: "Valor perdido", value: formatBRL(stats.valor_perdido) },
    { label: "Taxa de aprovação", value: `${stats.taxa_aprovacao.toFixed(0)}%` },
    { label: "Tempo médio até visualização", value: `${conv.tempo_medio_visualizacao_h.toFixed(1)}h` },
  ];

  return (
    <AppShell
      title="Propostas"
      subtitle="Gestão comercial — criação, envio, aprovação e conversão"
      actions={
        <Button className="btn-gradient h-9 px-3 text-xs font-semibold" onClick={() => setNewOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova proposta
        </Button>
      }
    >
      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="surface-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-lg font-bold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Funil visual simplificado */}
      <div className="mt-4 surface-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Funil comercial
        </p>
        <FunilBar
          stages={[
            { label: "Enviadas", value: stats.enviadas, tone: "bg-sky-500" },
            { label: "Visualizadas", value: stats.visualizadas, tone: "bg-indigo-500" },
            { label: "Em negociação", value: propostas.filter((p) => p.status === "ajustes_solicitados").length, tone: "bg-amber-500" },
            { label: "Aprovadas", value: stats.aprovadas, tone: "bg-emerald-500" },
          ]}
        />
      </div>

      {/* KPIs financeiros */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {moneyKpis.map((k) => (
          <div key={k.label} className="surface-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-sm font-bold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar número ou título…"
            className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProposalStatus | "todos")}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(PROPOSAL_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="mt-4 surface-card overflow-hidden">
        {q.isLoading ? (
          <p className="py-12 text-center text-xs text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
            <Button className="btn-gradient mt-3 h-8 text-xs" onClick={() => setNewOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Criar primeira proposta
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Número</th>
                <th className="px-3 py-2 text-left">Título</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Implantação</th>
                <th className="px-3 py-2 text-right">Mensal</th>
                <th className="px-3 py-2 text-left">Atualizada</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/40"
                  onClick={() => nav({ to: "/propostas/$id", params: { id: p.id } })}
                >
                  <td className="px-3 py-2 font-mono text-xs">{p.numero}</td>
                  <td className="px-3 py-2">{p.titulo}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${PROPOSAL_STATUS_TONE[p.status]}`}>
                      {PROPOSAL_STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{formatBRL(p.valor_implantacao)}</td>
                  <td className="px-3 py-2 text-right text-xs">{formatBRL(p.valor_mensal)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to="/proposta/$token"
                      params={{ token: p.token_publico }}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> link
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NovaPropostaDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={async (id) => {
          setNewOpen(false);
          await qc.invalidateQueries({ queryKey: propostasKeys.all });
          nav({ to: "/propostas/$id", params: { id } });
        }}
      />
    </AppShell>
  );
}

function FunilBar({ stages }: { stages: { label: string; value: number; tone: string }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="space-y-2">
      {stages.map((s) => {
        const pct = (s.value / max) * 100;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">{s.label}</span>
            <div className="h-6 flex-1 rounded bg-card/60">
              <div
                className={`h-6 rounded ${s.tone} flex items-center justify-end pr-2 text-[11px] font-semibold text-white transition-all`}
                style={{ width: `${Math.max(8, pct)}%` }}
              >
                {s.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NovaPropostaDialog({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const dealsQ = useQuery({
    queryKey: ["crm", "deals", "for-proposal"],
    queryFn: listDeals,
    enabled: open,
  });
  const [dealId, setDealId] = useState<string>("");
  const [titulo, setTitulo] = useState("Proposta Comercial");

  const create = useMutation({
    mutationFn: async () => {
      if (!dealId) throw new Error("Selecione uma oportunidade");
      return createProposalFromDeal(dealId, titulo);
    },
    onSuccess: (id) => {
      toast.success("Proposta criada");
      onCreated(id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova proposta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Oportunidade (CRM)</label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecione uma oportunidade…" /></SelectTrigger>
              <SelectContent>
                {(dealsQ.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.client?.company || d.title} — {d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              A proposta herda automaticamente cliente, contato, segmento e observações do deal.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="btn-gradient" onClick={() => create.mutate()} disabled={create.isPending || !dealId}>
            {create.isPending ? "Criando…" : "Criar proposta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export helper para o CRM/prospects criar proposta direto
export { createProposalFromProspect };