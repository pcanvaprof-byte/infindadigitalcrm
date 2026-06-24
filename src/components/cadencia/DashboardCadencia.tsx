import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { fetchMetrics } from "@/lib/cadencia/api";
import { CAD_STAGE_LABEL, type CadStage } from "@/lib/cadencia/types";
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
  const m = q.data;
  const by = m?.by_stage ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPI label="Total em Cadência" value={m?.total ?? 0} />
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
        <KPI label="Taxa de Resposta" value={`${m?.taxa_resposta ?? 0}%`} />
        <KPI label="Taxa de Conversão" value={`${m?.taxa_conversao ?? 0}%`} />
      </div>

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