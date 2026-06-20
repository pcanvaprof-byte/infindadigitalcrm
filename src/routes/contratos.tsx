import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  contratosKeys,
  fetchContratoKpis,
  listContratos,
} from "@/lib/contratos/api";
import {
  CONTRATO_STATUS_LABEL,
  CONTRATO_STATUS_TONE,
  type ContratoStatus,
} from "@/lib/contratos/types";
import { formatBRL } from "@/lib/catalog/types";
import {
  FileSignature,
  Search,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/contratos")({
  head: () => ({ meta: [{ title: "Contratos — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <ContratosPage />
    </RequireAuth>
  ),
});

function ContratosPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ContratoStatus | "todos">("todos");

  const listQ = useQuery({ queryKey: contratosKeys.all, queryFn: listContratos });
  const kpisQ = useQuery({ queryKey: contratosKeys.kpis, queryFn: fetchContratoKpis });

  const contratos = listQ.data ?? [];
  const kpis = kpisQ.data ?? {
    ativos: 0,
    pendentes: 0,
    assinados: 0,
    cancelados: 0,
    mrr: 0,
    arr: 0,
    ticket_medio: 0,
  };

  const filtered = useMemo(() => {
    return contratos.filter((c) => {
      if (status !== "todos" && c.status !== status) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return c.numero?.toLowerCase().includes(s);
    });
  }, [contratos, q, status]);

  const kpiCards = [
    { label: "Ativos", value: String(kpis.ativos), icon: ShieldCheck, tone: "text-emerald-300" },
    { label: "Pendentes", value: String(kpis.pendentes), icon: Clock, tone: "text-amber-300" },
    { label: "Assinados", value: String(kpis.assinados), icon: CheckCircle2, tone: "text-sky-300" },
    { label: "Cancelados", value: String(kpis.cancelados), icon: XCircle, tone: "text-rose-300" },
    { label: "MRR", value: formatBRL(kpis.mrr), icon: TrendingUp, tone: "text-primary-glow" },
    { label: "ARR", value: formatBRL(kpis.arr), icon: TrendingUp, tone: "text-primary-glow" },
  ];

  return (
    <AppShell
      title="Contratos"
      subtitle="Formalização contratual — onboarding, assinatura e governança"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="surface-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </p>
                <Icon className={`h-3.5 w-3.5 ${k.tone}`} />
              </div>
              <p className="mt-1 text-lg font-bold tracking-tight">{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar número…"
            className="h-9 pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as ContratoStatus | "todos")}>
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(CONTRATO_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 surface-card overflow-hidden">
        {listQ.isLoading ? (
          <p className="py-12 text-center text-xs text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <FileSignature className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum contrato encontrado.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Contratos são criados ao formalizar uma proposta aprovada.
            </p>
            <Link
              to="/propostas"
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              Ir para Propostas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Número</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Implantação</th>
                <th className="px-3 py-2 text-right">Mensal</th>
                <th className="px-3 py-2 text-left">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/40"
                  onClick={() => nav({ to: "/contratos/$id", params: { id: c.id } })}
                >
                  <td className="px-3 py-2 font-mono text-xs">{c.numero}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${CONTRATO_STATUS_TONE[c.status]}`}
                    >
                      {CONTRATO_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{formatBRL(c.valor_implantacao)}</td>
                  <td className="px-3 py-2 text-right text-xs">{formatBRL(c.valor_mensal)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}