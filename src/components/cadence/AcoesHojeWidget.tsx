import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Flame, Clock, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  cadenceKeys,
  fetchAcoesHoje,
  snoozeProspect,
  type AcaoHoje,
} from "@/lib/cadence/api";
import { crmKeys } from "@/lib/crm/api";
import { TouchpointModal } from "./TouchpointModal";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function AcoesHojeWidget() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: cadenceKeys.acoesHoje,
    queryFn: () => fetchAcoesHoje(50),
    staleTime: 30_000,
  });
  const [target, setTarget] = useState<AcaoHoje | null>(null);

  const snooze = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => snoozeProspect(id, days),
    onSuccess: () => {
      toast.success("Adiado.");
      qc.invalidateQueries({ queryKey: cadenceKeys.acoesHoje });
      qc.invalidateQueries({ queryKey: cadenceKeys.dashboard });
      qc.invalidateQueries({ queryKey: crmKeys.prospects });
    },
    onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
  });

  const rows = q.data ?? [];

  return (
    <section className="surface-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-rose-300" />
          <h3 className="text-sm font-semibold">Ações de hoje</h3>
          <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Cadência ativa · próximas 24h
        </p>
      </div>

      {q.isLoading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : q.error ? (
        <p className="mt-4 text-xs text-rose-300">
          {(q.error as Error).message.includes("dashboard_metrics") ||
          (q.error as Error).message.includes("acoes_hoje")
            ? "Migration da Fase 6 ainda não foi executada."
            : (q.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Nada para hoje. Cadastre touchpoints para iniciar a cadência automática.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2">Empresa</th>
                <th className="py-2">Último contato</th>
                <th className="py-2">Próximo</th>
                <th className="py-2">Atraso</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 font-medium">{r.company}</td>
                  <td className="py-2 text-muted-foreground">{fmtDate(r.last_contact_at)}</td>
                  <td className="py-2 text-muted-foreground">{fmtDate(r.next_contact_at)}</td>
                  <td className="py-2">
                    {r.dias_atraso > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">
                        <Clock className="h-3 w-3" /> {r.dias_atraso}d
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" className="h-7 text-[11px]" onClick={() => setTarget(r)}>
                        <MessageSquare className="mr-1 h-3 w-3" /> Registrar
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]">
                            Adiar <ChevronDown className="ml-1 h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {[1, 3, 7].map((d) => (
                            <DropdownMenuItem key={d} onClick={() => snooze.mutate({ id: r.id, days: d })}>
                              {d} dia{d > 1 ? "s" : ""}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <TouchpointModal
          open={!!target}
          onOpenChange={(v) => !v && setTarget(null)}
          prospectId={target.id}
          company={target.company}
          cadenceStep={target.cadence_step}
        />
      )}
    </section>
  );
}