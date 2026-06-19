import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, useRequiredUser } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INITIAL_DEALS, STAGES, type Deal, type PipelineStage } from "@/lib/mock-crm";
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

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

function DealCard({ deal, dragging = false }: { deal: Deal; dragging?: boolean }) {
  return (
    <div
      className={`surface-card group cursor-grab rounded-lg p-3 transition-shadow active:cursor-grabbing ${
        dragging ? "rotate-2 shadow-2xl" : "hover:shadow-[0_10px_30px_-15px_oklch(0_0_0/0.7)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{deal.company}</p>
          <p className="truncate text-[11px] text-muted-foreground">{deal.segment}</p>
        </div>
        <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary-glow">
          {brl(deal.value)}
        </span>
      </div>
      <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <User2 className="h-3 w-3" /> {deal.contact}
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> {deal.city}
        </p>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--gradient-primary)] text-[9px] font-bold text-primary-foreground">
          {deal.owner[0]}
        </span>
        <span className="text-[10px] text-muted-foreground">{deal.updatedAt}</span>
      </div>
    </div>
  );
}

function DraggableDeal({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0 : 1 }}
    >
      <DealCard deal={deal} />
    </div>
  );
}

function StageColumn({
  stage,
  deals,
}: {
  stage: (typeof STAGES)[number];
  deals: Deal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex w-[85vw] max-w-[300px] shrink-0 snap-start flex-col sm:w-[280px]">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: stage.tone }} />
          <span className="text-xs font-semibold">{stage.label}</span>
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {deals.length}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{brl(total)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-xl border border-dashed border-border p-2 transition-colors ${
          isOver ? "border-primary-glow bg-accent/30" : "bg-card/30"
        }`}
        style={{ minHeight: 200 }}
      >
        {deals.map((d) => (
          <DraggableDeal key={d.id} deal={d} />
        ))}
        {deals.length === 0 && (
          <p className="py-8 text-center text-[11px] text-muted-foreground">
            Arraste cards aqui
          </p>
        )}
      </div>
    </div>
  );
}

function CrmPage() {
  const user = useRequiredUser();
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(() => {
    if (!query.trim()) return deals;
    const q = query.toLowerCase();
    return deals.filter(
      (d) =>
        d.company.toLowerCase().includes(q) ||
        d.contact.toLowerCase().includes(q) ||
        d.segment.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q),
    );
  }, [deals, query]);

  const grouped = useMemo(() => {
    const map = new Map<PipelineStage, Deal[]>();
    STAGES.forEach((s) => map.set(s.id, []));
    filtered.forEach((d) => map.get(d.stage)?.push(d));
    return map;
  }, [filtered]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const overId = over.id as PipelineStage;
    setDeals((prev) => {
      const deal = prev.find((d) => d.id === active.id);
      if (!deal || deal.stage === overId) return prev;
      const stageLabel = STAGES.find((s) => s.id === overId)?.label;
      toast.success(`${deal.company} movido para "${stageLabel}"`);
      return prev.map((d) => (d.id === active.id ? { ...d, stage: overId, updatedAt: "agora" } : d));
    });
  };

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;
  const total = deals.reduce((s, d) => s + d.value, 0);
  const won = deals.filter((d) => d.stage === "fechado").reduce((s, d) => s + d.value, 0);

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
          { label: "Total no pipeline", value: brl(total) },
          { label: "Oportunidades", value: deals.length.toString() },
          { label: "Ganho no mês", value: brl(won) },
          { label: "Taxa de conversão", value: `${((deals.filter((d) => d.stage === "fechado").length / deals.length) * 100).toFixed(0)}%` },
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
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            {STAGES.map((stage) => (
              <StageColumn key={stage.id} stage={stage} deals={grouped.get(stage.id) ?? []} />
            ))}
          </div>
          <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} dragging /> : null}</DragOverlay>
        </DndContext>
      </div>
    </AppShell>
  );
}
