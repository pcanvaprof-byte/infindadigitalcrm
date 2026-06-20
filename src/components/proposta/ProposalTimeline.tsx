import { useQuery } from "@tanstack/react-query";
import { biKeys, fetchProposalTimeline, type ProposalTimelineEvent } from "@/lib/propostas/bi";
import {
  FileText, Send, Eye, CheckCircle2, XCircle, MessageSquare, Download,
  Clock, FileSignature, Briefcase, Calendar, Receipt, Percent, ListChecks,
} from "lucide-react";

/**
 * Timeline reproduzível por proposta — lê vw_proposal_timeline.
 * Nunca calcula nada localmente; apenas mapeia evt_* → ícone + rótulo.
 */
const LABEL: Record<string, { label: string; Icon: typeof FileText; tone: string }> = {
  evt_proposal_created:        { label: "Proposta criada",            Icon: FileText,      tone: "text-muted-foreground" },
  evt_version_created:         { label: "Nova versão",                Icon: ListChecks,    tone: "text-muted-foreground" },
  evt_proposal_sent:           { label: "Enviada ao cliente",         Icon: Send,          tone: "text-blue-600" },
  evt_proposal_viewed:         { label: "Visualizada",                Icon: Eye,           tone: "text-indigo-600" },
  evt_proposal_downloaded:     { label: "PDF baixado",                Icon: Download,      tone: "text-indigo-500" },
  evt_proposal_approved:       { label: "Aprovada",                   Icon: CheckCircle2,  tone: "text-emerald-600" },
  evt_proposal_rejected:       { label: "Rejeitada",                  Icon: XCircle,       tone: "text-rose-600" },
  evt_adjustments_requested:   { label: "Ajustes solicitados",        Icon: MessageSquare, tone: "text-amber-600" },
  evt_item_accepted:           { label: "Item aceito",                Icon: CheckCircle2,  tone: "text-emerald-500" },
  evt_item_rejected:           { label: "Item recusado",              Icon: XCircle,       tone: "text-rose-500" },
  evt_discount_applied:        { label: "Desconto aplicado",          Icon: Percent,       tone: "text-amber-500" },
  evt_proposal_expired:        { label: "Validade expirada",          Icon: Clock,         tone: "text-muted-foreground" },
  evt_briefing_created:        { label: "Briefing iniciado",          Icon: Briefcase,     tone: "text-blue-500" },
  evt_briefing_completed:      { label: "Briefing concluído",         Icon: CheckCircle2,  tone: "text-emerald-500" },
  evt_kickoff_created:         { label: "Kickoff agendado",           Icon: Calendar,      tone: "text-blue-500" },
  evt_contract_signed:         { label: "Contrato assinado",          Icon: FileSignature, tone: "text-emerald-600" },
};

function eventMeta(type: string) {
  return LABEL[type] ?? { label: type, Icon: Receipt, tone: "text-muted-foreground" };
}

function fmt(ts: string): string {
  try { return new Date(ts).toLocaleString("pt-BR"); } catch { return ts; }
}

function summarize(ev: ProposalTimelineEvent): string | null {
  const p = ev.payload ?? {};
  if (ev.event_type === "evt_proposal_sent" && typeof p.canal === "string") return `Canal: ${p.canal}`;
  if (ev.event_type === "evt_discount_applied" && p.desconto_percentual) {
    return `${p.desconto_percentual}% — motivo: ${String(p.motivo ?? "—")}`;
  }
  if (ev.event_type === "evt_proposal_rejected" && typeof p.motivo === "string") return `Motivo: ${p.motivo}`;
  if (ev.actor_type === "client") return "Ação do cliente";
  return null;
}

export function ProposalTimeline({ proposalId }: { proposalId: string }) {
  const q = useQuery({
    queryKey: biKeys.timeline(proposalId),
    queryFn: () => fetchProposalTimeline(proposalId),
  });

  if (q.isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando histórico…</p>;
  }
  if (q.error) {
    return <p className="text-xs text-rose-600">Erro ao carregar timeline.</p>;
  }
  const events = q.data ?? [];
  if (!events.length) {
    return <p className="text-xs text-muted-foreground">Sem eventos registrados ainda.</p>;
  }

  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {events.map((ev) => {
        const meta = eventMeta(ev.event_type);
        const detail = summarize(ev);
        return (
          <li key={ev.id} className="relative">
            <span className="absolute -left-[1.36rem] flex h-5 w-5 items-center justify-center rounded-full bg-background ring-1 ring-border">
              <meta.Icon className={`h-3 w-3 ${meta.tone}`} />
            </span>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{meta.label}</p>
              <time className="text-[10px] text-muted-foreground">{fmt(ev.created_at)}</time>
            </div>
            {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}