import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { listClients } from "@/modules/lifecycle/api";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  STAGE_TONE,
  type PipelineStage,
} from "@/modules/lifecycle/types";

export const Route = createFileRoute("/pipeline")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pipeline 360 — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Pipeline" subtitle="Ciclo de vida do cliente">
        <PipelinePage />
      </AppShell>
    </RequireAuth>
  ),
});

function PipelinePage() {
  const q = useQuery({ queryKey: ["lc-clients"], queryFn: () => listClients() });

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, NonNullable<typeof q.data>>();
    PIPELINE_STAGES.forEach((s) => map.set(s, []));
    (q.data ?? []).forEach((c) => {
      const arr = map.get(c.pipeline_stage) ?? [];
      arr.push(c);
      map.set(c.pipeline_stage, arr);
    });
    return map;
  }, [q.data]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map((stage) => {
        const items = byStage.get(stage) ?? [];
        return (
          <div key={stage} className="w-[260px] shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STAGE_TONE[stage]}`}>
                {STAGE_LABEL[stage]}
              </span>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((c) => (
                <Link key={c.id} to="/clients/$id" params={{ id: c.id }} className="block">
                  <Card className="p-3 transition hover:bg-accent/40">
                    <p className="truncate text-sm font-medium">{c.company}</p>
                    {c.contact_name && (
                      <p className="truncate text-xs text-muted-foreground">{c.contact_name}</p>
                    )}
                    {c.current_step && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">→ {c.current_step}</p>
                    )}
                  </Card>
                </Link>
              ))}
              {items.length === 0 && (
                <p className="rounded border border-dashed border-border/40 p-2 text-center text-[11px] text-muted-foreground">
                  vazio
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}