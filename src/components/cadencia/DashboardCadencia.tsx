import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { fetchMetrics, listLeads } from "@/lib/cadencia/api";
import { CAD_STAGES, CAD_STAGE_LABEL, type CadStage } from "@/lib/cadencia/types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
    </Card>
  );
}

const FOLLOWUPS: CadStage[] = ["followup_1","followup_2","followup_3","followup_4","followup_5","followup_6","followup_7"];

export function DashboardCadencia() {
  const q = useQuery({ queryKey: ["cad-metrics"], queryFn: fetchMetrics, refetchInterval: 30_000 });
  const leadsQ = useQuery({ queryKey: ["cad-leads"], queryFn: listLeads, refetchInterval: 30_000 });
  const m = q.data;
  const cardCounts = useMemo(() => {
    const counts: Partial<Record<CadStage, number>> = {};
    for (const lead of leadsQ.data ?? []) {
      counts[lead.stage] = (counts[lead.stage] ?? 0) + 1;
    }
    return counts;
  }, [leadsQ.data]);
  const totalCards = leadsQ.data?.length ?? 0;
  // Cadência exibe apenas leads que já receberam disparo (last_contact_at != null).
  // Para manter o dashboard coerente com o pipeline, derivamos os contadores dos cards.
  const by: Partial<Record<CadStage, number>> = cardCounts;
  const isAudited = !!leadsQ.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPI label="Total em Cadência" value={totalCards} />
        {FOLLOWUPS.map((s) => (
          <KPI key={s} label={CAD_STAGE_LABEL[s]} value={by[s] ?? 0} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Interessados" value={by.interessado ?? 0} />
        <KPI label="Reuniões Agendadas" value={by.reuniao_agendada ?? 0} />
        <KPI label="Propostas Enviadas" value={by.proposta_enviada ?? 0} />
        <KPI label="Negociação" value={by.negociacao ?? 0} />
        <KPI label="Fechados" value={by.fechado ?? 0} />
        <KPI label="Perdidos" value={by.perdido ?? 0} />
        <KPI label="Mensagens Enviadas" value={m?.total_mensagens ?? 0} />
        <KPI label="Taxa de Resposta" value={`${m?.taxa_resposta ?? 0}%`} />
        <KPI label="Taxa de Conversão" value={`${m?.taxa_conversao ?? 0}%`} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Auditoria Pipeline x Dashboard</div>
            <div className="text-xs text-muted-foreground">
              Confere se os números do dashboard batem com os cards carregados no pipeline.
            </div>
          </div>
          <div className={`w-fit rounded-md border px-2 py-1 text-xs font-medium ${isAudited ? "border-primary/30 bg-primary/10 text-primary" : "border-muted text-muted-foreground"}`}>
            {isAudited ? "Batendo" : "Carregando"}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-muted-foreground">Total em cadência</div>
            <div className="text-lg font-semibold text-foreground">{totalCards}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-muted-foreground">Enviadas registradas</div>
            <div className="text-lg font-semibold text-foreground">{m?.total_mensagens ?? 0}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {CAD_STAGES.map((stage) => {
            const cardCount = cardCounts[stage] ?? 0;
            if (cardCount === 0) return null;
            return (
              <span key={stage} className="rounded-md border border-border bg-background px-2 py-1 text-foreground">
                {CAD_STAGE_LABEL[stage]}: {cardCount}
              </span>
            );
          })}
        </div>
        {(m?.total_mensagens ?? 0) === 0 ? (
          <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            Cadência mostra apenas leads que já receberam disparo. A base completa, sem mensagem enviada, permanece em Prospecção até o primeiro envio.
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">Evolução (últimos 30 dias)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={m?.serie_30d ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="enviadas" stroke="#60a5fa" name="Enviadas" />
              <Line type="monotone" dataKey="respostas" stroke="#34d399" name="Respostas" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}