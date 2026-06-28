import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { dashboardV8Keys, fetchTeamRanking, type DashboardFiltersV8 } from "@/lib/dashboard/api-v8";

export function TeamRankingChart({ filters }: { filters: DashboardFiltersV8 }) {
  const q = useQuery({
    queryKey: dashboardV8Keys.ranking(filters),
    queryFn: () => fetchTeamRanking(filters),
    staleTime: 30_000,
  });
  const data = (q.data ?? []).slice(0, 10);

  return (
    <div className="surface-card p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Ranking de equipes
      </h4>
      <div className="h-64">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Sem equipes cadastradas ainda.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 0, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" fontSize={10} />
              <YAxis type="category" dataKey="team_name" fontSize={10} width={120} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ganhos"    fill="#22c55e" radius={[0, 3, 3, 0]} />
              <Bar dataKey="perdidos"  fill="#ef4444" radius={[0, 3, 3, 0]} />
              <Bar dataKey="contatos"  fill="#6366f1" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}