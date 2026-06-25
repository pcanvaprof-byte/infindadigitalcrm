import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { advanceStage, getClient } from "@/modules/lifecycle/api";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  STAGE_TONE,
  type PipelineStage,
} from "@/modules/lifecycle/types";

export const Route = createFileRoute("/operacoes/clientes/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cliente · INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Cliente" subtitle="Visão 360">
        <ClientDetail />
      </AppShell>
    </RequireAuth>
  ),
});

const TABS = [
  { to: "", label: "Resumo" },
  { to: "comercial", label: "Comercial" },
  { to: "documentos", label: "Documentos" },
  { to: "operacoes", label: "Operações" },
  { to: "financeiro", label: "Financeiro" },
  { to: "historico", label: "Histórico" },
] as const;

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const q = useQuery({ queryKey: ["lc-client", id], queryFn: () => getClient(id) });

  const advanceM = useMutation({
    mutationFn: (to: PipelineStage) => advanceStage(id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lc-client", id] });
      qc.invalidateQueries({ queryKey: ["lc-clients"] });
      qc.invalidateQueries({ queryKey: ["lc-timeline", id] });
      toast.success("Estágio atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!q.data) return <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>;

  const c = q.data;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-semibold">{c.company}</p>
            <p className="text-sm text-muted-foreground">
              {[c.contact_name, c.phone, c.email].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-1 text-[11px] font-semibold ${STAGE_TONE[c.pipeline_stage]}`}>
              {STAGE_LABEL[c.pipeline_stage]}
            </span>
            <Select value={c.pipeline_stage} onValueChange={(v) => advanceM.mutate(v as PipelineStage)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {c.operations_locked && c.pipeline_stage !== "ATIVO" && (
          <p className="mt-3 text-xs text-amber-400">
            🔒 Operações bloqueadas — libere ao avançar para <b>ATIVO</b>.
          </p>
        )}
      </Card>

      <div className="flex gap-1 overflow-x-auto border-b border-border/40">
        {TABS.map((t) => {
          const target = t.to ? `/operacoes/clientes/${id}/${t.to}` : `/operacoes/clientes/${id}`;
          const active = t.to
            ? pathname.endsWith(`/${t.to}`)
            : pathname === `/operacoes/clientes/${id}` || pathname === `/operacoes/clientes/${id}/`;
          return (
            <Link
              key={t.to || "resumo"}
              to={target}
              className={`border-b-2 px-3 py-2 text-sm ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}