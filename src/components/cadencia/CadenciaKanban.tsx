import { useMemo, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CAD_STAGES, CAD_STAGE_LABEL, type CadLead, type CadStage, type CadTemplate } from "@/lib/cadencia/types";
import { listResolvedTemplates, moveStage, type ResolvedTemplate } from "@/lib/cadencia/api";
import { sortLeadsByDispatchDate, filterLeadsByDispatch, type DispatchFilter } from "@/lib/cadencia/sort";
import { LeadCard } from "./LeadCard";

function Draggable({ lead, children }: { lead: CadLead; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

function Column({
  stage, leads, onOpen, onSend, template,
}: { stage: CadStage; leads: CadLead[]; onOpen: (l: CadLead) => void; onSend: (l: CadLead) => void; template?: CadTemplate | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage}` });
  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-lg border border-border bg-muted/20 p-2 ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-foreground">{CAD_STAGE_LABEL[stage]}</div>
        <div className="text-xs text-muted-foreground">{leads.length}</div>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {leads.map((l) => (
          <Draggable key={l.id} lead={l}>
            <LeadCard lead={l} onOpen={() => onOpen(l)} onSend={() => onSend(l)} template={template} />
          </Draggable>
        ))}
      </div>
    </div>
  );
}

export function CadenciaKanban({
  leads, onOpen, onSend,
}: { leads: CadLead[]; onOpen: (l: CadLead) => void; onSend: (l: CadLead) => void }) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const tplQ = useQuery({ queryKey: ["cad-resolved-templates"], queryFn: listResolvedTemplates });
  const tplByStage = useMemo(() => {
    const m = new Map<CadStage, CadTemplate>();
    for (const t of (tplQ.data ?? []) as ResolvedTemplate[]) {
      m.set(t.stage, {
        id: `${t.stage}-${t.source}`,
        organization_id: "",
        stage: t.stage,
        titulo: t.titulo,
        corpo: t.corpo,
        updated_at: "",
      });
    }
    return m;
  }, [tplQ.data]);
  const [dispatchFilter, setDispatchFilter] = useState<DispatchFilter>("all");
  const byStage = useMemo(() => {
    const m = new Map<CadStage, CadLead[]>();
    for (const s of CAD_STAGES) m.set(s, []);
    const filtered = filterLeadsByDispatch(leads, dispatchFilter);
    for (const l of filtered) m.get(l.stage)?.push(l);
    for (const [s, arr] of m) m.set(s, sortLeadsByDispatchDate(arr));
    return m;
  }, [leads, dispatchFilter]);

  const moveM = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: CadStage }) => moveStage(id, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cad-leads"] });
      qc.invalidateQueries({ queryKey: ["cad-metrics"] });
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Lead movido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id;
    if (!overId || typeof overId !== "string" || !overId.startsWith("col-")) return;
    const stage = overId.slice(4) as CadStage;
    const leadId = e.active.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === stage) return;
    moveM.mutate({ id: leadId, stage });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-2 text-xs">
        <span className="font-semibold text-foreground">Total: {leads.length}</span>
        <span className="text-muted-foreground">·</span>
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {([
            ["all", "Todos"],
            ["due", "No prazo"],
            ["overdue", "Vencidos"],
            ["future", "Futuros"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDispatchFilter(key)}
              className={`px-2 py-0.5 ${dispatchFilter === key ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground">·</span>
        {CAD_STAGES.map((s) => {
          const n = byStage.get(s)?.length ?? 0;
          if (n === 0) return null;
          return (
            <span key={s} className="rounded-md border border-border bg-background px-2 py-0.5 text-foreground">
              {CAD_STAGE_LABEL[s]}: <span className="font-semibold">{n}</span>
            </span>
          );
        })}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {CAD_STAGES.map((s) => (
          <Column key={s} stage={s} leads={byStage.get(s) ?? []} onOpen={onOpen} onSend={onSend} template={tplByStage.get(s) ?? null} />
        ))}
      </div>
    </DndContext>
  );
}