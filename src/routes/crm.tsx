import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crmKeys } from "@/lib/crm/api";
import { loadMyProspects, updateProspect } from "@/lib/prospects-api";
import {
  STATUS_LABEL,
  type Prospect,
  type ProspectStatus,
} from "@/lib/mock-prospects";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Building2, MapPin, Plus, Search, User2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [{ title: "CRM Comercial — INFINDA" }],
  }),
  component: () => (
    <RequireAuth>
      <CrmPage />
    </RequireAuth>
  ),
});

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// Estágios do funil — derivados do ProspectStatus. Define a ordem visual.
const PIPELINE_STAGES: { id: ProspectStatus; tone: string; tone_won?: boolean; tone_lost?: boolean }[] = [
  { id: "primeiro_contato", tone: "#38bdf8" },
  { id: "em_negociacao", tone: "#f59e0b" },
  { id: "qualificado", tone: "#a78bfa" },
  { id: "agendado", tone: "#10b981" },
  { id: "briefing_enviado", tone: "#6366f1" },
  { id: "proposta_enviada", tone: "#fb923c" },
  { id: "fechado_ganho", tone: "#22c55e", tone_won: true },
  { id: "perdido", tone: "#f43f5e", tone_lost: true },
];
const STAGE_IDS = new Set<ProspectStatus>(PIPELINE_STAGES.map((s) => s.id));

function ProspectCard({ p, dragging = false }: { p: Prospect; dragging?: boolean }) {
  const contact = p.owner || "—";
  const city = [p.city, p.state].filter(Boolean).join("/") || "—";
  const segment = p.segment || "Sem segmento";
  const ownerInitial = (p.owner || p.company || "?")[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`surface-card group cursor-grab rounded-lg p-3 transition-shadow active:cursor-grabbing ${
        dragging ? "rotate-2 shadow-2xl" : "hover:shadow-[0_10px_30px_-15px_oklch(0_0_0/0.7)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{p.company}</p>
          <p className="truncate text-[11px] text-muted-foreground">{segment}</p>
        </div>
      </div>
      <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <User2 className="h-3 w-3" /> {contact}
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> {city}
        </p>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--gradient-primary)] text-[9px] font-bold text-primary-foreground">
          {ownerInitial}
        </span>
        <span className="text-[10px] text-muted-foreground">{timeAgo(p.createdAt)}</span>
      </div>
    </div>
  );
}

function DraggableProspect({ p }: { p: Prospect }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0 : 1 }}
    >
      <ProspectCard p={p} />
    </div>
  );
}

function StageColumn({
  stage,
  items,
}: {
  stage: { id: ProspectStatus; tone: string };
  items: Prospect[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="flex w-[85vw] max-w-[300px] shrink-0 snap-start flex-col sm:w-[280px]">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: stage.tone }} />
          <span className="text-xs font-semibold">{STATUS_LABEL[stage.id]}</span>
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {items.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-xl border border-dashed border-border p-2 transition-colors ${
          isOver ? "border-primary-glow bg-accent/30" : "bg-card/30"
        }`}
        style={{ minHeight: 200 }}
      >
        {items.map((p) => (
          <DraggableProspect key={p.id} p={p} />
        ))}
        {items.length === 0 && (
          <p className="py-8 text-center text-[11px] text-muted-foreground">
            Arraste cards aqui
          </p>
        )}
      </div>
    </div>
  );
}

function CrmPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const prospectsQ = useQuery({
    queryKey: [...crmKeys.prospects, "mine"] as const,
    queryFn: loadMyProspects,
    staleTime: 5_000,
  });
  const prospects: Prospect[] = prospectsQ.data ?? [];

  const moveMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProspectStatus }) =>
      updateProspect(id, { status }),
    onMutate: async ({ id, status }) => {
      const key = [...crmKeys.prospects, "mine"] as const;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Prospect[]>(key);
      qc.setQueryData<Prospect[]>(key, (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, status } : p)),
      );
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev && ctx.key) qc.setQueryData(ctx.key, ctx.prev);
      toast.error(`Falha ao mover card: ${(err as Error).message}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.prospects });
    },
  });

  const filtered = useMemo(() => {
    // Mostra apenas cards já em algum estágio do funil (exclui "nao_contatado"
    // e pós-venda como "cliente"/"em_producao" etc.).
    const inPipeline = prospects.filter((p) => STAGE_IDS.has(p.status));
    if (!query.trim()) return inPipeline;
    const q = query.toLowerCase();
    return inPipeline.filter(
      (p) =>
        p.company.toLowerCase().includes(q) ||
        (p.owner || "").toLowerCase().includes(q) ||
        (p.segment || "").toLowerCase().includes(q) ||
        (p.city || "").toLowerCase().includes(q),
    );
  }, [prospects, query]);

  const grouped = useMemo(() => {
    const map = new Map<ProspectStatus, Prospect[]>();
    PIPELINE_STAGES.forEach((s) => map.set(s.id, []));
    filtered.forEach((p) => map.get(p.status)?.push(p));
    return map;
  }, [filtered]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const status = String(over.id) as ProspectStatus;
    if (!STAGE_IDS.has(status)) return;
    const p = prospects.find((x) => x.id === active.id);
    if (!p || p.status === status) return;
    moveMut.mutate({ id: p.id, status });
    toast.success(`${p.company} movido para "${STATUS_LABEL[status]}"`);
  };

  const activeProspect = activeId ? prospects.find((p) => p.id === activeId) ?? null : null;
  const inPipeline = filtered;
  const wonCount = inPipeline.filter((p) => p.status === "fechado_ganho").length;
  const lostCount = inPipeline.filter((p) => p.status === "perdido").length;
  const conversion = inPipeline.length
    ? `${((wonCount / inPipeline.length) * 100).toFixed(0)}%`
    : "0%";
  const loading = prospectsQ.isLoading;

  return (
    <AppShell
      title="CRM Comercial"
      subtitle="Pipeline de vendas — arraste para mover entre etapas"
      actions={
        <Button className="btn-gradient hidden h-9 px-3 text-xs font-semibold sm:inline-flex">
          <Plus className="mr-1.5 h-4 w-4" /> Nova empresa
        </Button>
      }
    >
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Oportunidades", value: inPipeline.length.toString() },
          { label: "Ganhos", value: wonCount.toString() },
          { label: "Perdidos", value: lostCount.toString() },
          { label: "Taxa de conversão", value: conversion },
        ].map((s) => (
          <div key={s.label} className="surface-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-lg font-bold tracking-tight">{s.value}</p>
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
            placeholder="Buscar empresa, contato, segmento…"
            className="h-9 pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="h-9">
          <Building2 className="mr-1.5 h-3.5 w-3.5" /> Filtros
        </Button>
        <Button className="btn-gradient ml-auto h-9 px-3 text-xs font-semibold sm:hidden">
          <Plus className="mr-1.5 h-4 w-4" /> Nova
        </Button>
      </div>

      {/* Kanban */}
      <div className="mt-5 -mx-3 snap-x snap-mandatory overflow-x-auto px-3 pb-4 sm:-mx-6 sm:px-6 sm:snap-none lg:-mx-8 lg:px-8">
        {loading ? (
          <p className="py-12 text-center text-xs text-muted-foreground">Carregando pipeline…</p>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4">
              {PIPELINE_STAGES.map((stage) => (
                <StageColumn key={stage.id} stage={stage} items={grouped.get(stage.id) ?? []} />
              ))}
            </div>
            <DragOverlay>{activeProspect ? <ProspectCard p={activeProspect} dragging /> : null}</DragOverlay>
          </DndContext>
        )}
      </div>
    </AppShell>
  );
}
