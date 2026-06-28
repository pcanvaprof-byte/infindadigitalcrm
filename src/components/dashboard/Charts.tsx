import {
  Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import type { DashboardV7 } from "@/lib/dashboard/api-v7";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`surface-card p-4 ${className}`}>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="h-64">{children}</div>
    </div>
  );
}

export function EvolucaoDiariaChart({ data }: { data: DashboardV7["series"]["evolucao_diaria"] }) {
  const fmt = data.map((d) => ({ ...d, label: format(parseISO(d.day), "dd/MM", { locale: ptBR }) }));
  return (
    <Card title="Evolução diária (30 dias)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={fmt} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="contatos"  stroke={COLORS[0]} dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="respostas" stroke={COLORS[1]} dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="ganhos"    stroke={COLORS[2]} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function EvolucaoMensalChart({ data }: { data: DashboardV7["series"]["evolucao_mensal"] }) {
  const fmt = data.map((d) => ({ ...d, label: format(parseISO(d.month), "MMM/yy", { locale: ptBR }) }));
  return (
    <Card title="Evolução mensal (12 meses)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={fmt} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="contatos"  fill={COLORS[0]} radius={[3, 3, 0, 0]} />
          <Bar dataKey="respostas" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
          <Bar dataKey="ganhos"    fill={COLORS[2]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function FunilChart({ data }: { data: DashboardV7["series"]["funil"] }) {
  return (
    <Card title="Funil de conversão">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip />
          <Funnel dataKey="valor" data={data} isAnimationActive nameKey="etapa">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            <LabelList dataKey="etapa" position="right" fill="#cbd5e1" fontSize={11} />
            <LabelList dataKey="valor" position="center" fill="#fff" fontSize={11} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function RankingChart({ data }: { data: DashboardV7["series"]["ranking"] }) {
  const top = data.slice(0, 10);
  return (
    <Card title="Ranking de vendedores (período)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 5, right: 20, bottom: 0, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" fontSize={10} />
          <YAxis type="category" dataKey="owner_name" fontSize={10} width={120} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="ganhos"   fill={COLORS[1]} radius={[0, 3, 3, 0]} />
          <Bar dataKey="perdidos" fill={COLORS[3]} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function ComparacaoChart({ comp }: { comp: DashboardV7["comparacao"] }) {
  const data = [
    { metrica: "Contatos",  atual: comp.atual.contatos,  anterior: comp.anterior.contatos },
    { metrica: "Respostas", atual: comp.atual.respostas, anterior: comp.anterior.respostas },
    { metrica: "Ganhos",    atual: comp.atual.ganhos,    anterior: comp.anterior.ganhos },
    { metrica: "Perdidos",  atual: comp.atual.perdidos,  anterior: comp.anterior.perdidos },
    { metrica: "Receita",   atual: comp.atual.receita,   anterior: comp.anterior.receita },
  ];
  return (
    <Card title="Comparação: período atual × anterior">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="metrica" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="anterior" fill="#475569"  radius={[3, 3, 0, 0]} />
          <Bar dataKey="atual"    fill={COLORS[0]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function MetasChart({ metas }: { metas: DashboardV7["metas"] }) {
  const data = [
    { tipo: "Receita",  meta: metas.meta_receita,  realizado: metas.realizado_receita },
    { tipo: "Clientes", meta: metas.meta_clientes, realizado: metas.realizado_clientes },
    { tipo: "Contatos", meta: metas.meta_contatos, realizado: metas.realizado_contatos },
  ];
  return (
    <Card title={`Metas × Realizado (${String(metas.mes_ano.month).padStart(2,"0")}/${metas.mes_ano.year})`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="tipo" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="meta"      fill="#475569"  radius={[3, 3, 0, 0]} />
          <Bar dataKey="realizado" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}