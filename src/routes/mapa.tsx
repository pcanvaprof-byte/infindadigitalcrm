import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { loadMapPoints, bairroColor, type MapPoint } from "@/lib/tasks-map-api";
import { runEnrichment } from "@/lib/enrichment/api";
import { crmKeys } from "@/lib/crm/api";

const TasksMap = lazy(() => import("@/components/TasksMap").then((m) => ({ default: m.TasksMap })));

export const Route = createFileRoute("/mapa")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mapa de Leads — INFINDA" },
      { name: "description", content: "Mapa geográfico dos leads prospectados com endereço completo e CEP." },
      { property: "og:title", content: "Mapa de Leads — INFINDA" },
      { property: "og:description", content: "Visualize seus leads prospectados no mapa por bairro e cidade." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <MapaPage />
    </RequireAuth>
  ),
});

function MapaPage() {
  const qc = useQueryClient();
  const [selectedBairro, setSelectedBairro] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const pointsQ = useQuery({
    queryKey: crmKeys.tasks,
    queryFn: loadMapPoints,
    staleTime: 15_000,
  });
  const points: MapPoint[] = pointsQ.data ?? [];
  const loading = pointsQ.isLoading;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: crmKeys.tasks });
    qc.invalidateQueries({ queryKey: crmKeys.prospects });
  };

  const enrichMut = useMutation({
    mutationFn: async () => {
      const missing = points.filter((p) => !p.cep || !p.logradouro || !p.lat || !p.lon);
      if (!missing.length) {
        toast.info("Todos os leads já possuem endereço completo e coordenadas.");
        return 0;
      }
      const tid = toast.loading(`Enriquecendo 0/${missing.length}…`);
      let ok = 0;
      for (let i = 0; i < missing.length; i++) {
        try {
          await runEnrichment(missing[i].cnpj);
          ok++;
        } catch {
          /* segue para o próximo */
        }
        toast.loading(`Enriquecendo ${i + 1}/${missing.length}…`, { id: tid });
        await new Promise((r) => setTimeout(r, 1100));
      }
      toast.success(`Concluído: ${ok}/${missing.length}`, { id: tid });
      return ok;
    },
    onSuccess: refresh,
  });

  const enriching = enrichMut.isPending;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return points;
    return points.filter((p) =>
      [p.company, p.bairro, p.cidade, p.logradouro, p.cep, p.cnpj]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [points, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, MapPoint[]>();
    for (const p of filtered) {
      const key = p.bairro || "Sem bairro";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const withCoords = filtered.filter((p) => p.lat && p.lon).length;
  const withoutCoords = filtered.length - withCoords;
  const withoutCep = points.filter((p) => !p.cep).length;
  const withoutAddress = points.filter((p) => !p.logradouro).length;

  const missingList = useMemo(
    () => filtered.filter((p) => !p.cep || !p.logradouro).slice(0, 200),
    [filtered],
  );

  return (
    <AppShell title="Mapa" subtitle="Todos os leads prospectados com endereço completo e CEP">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_1fr_320px] lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="surface-card flex flex-col gap-3 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empresa, bairro, CEP…"
              className="h-9 pl-8 text-xs"
            />
          </div>

          <div className="rounded-md border border-border/60 p-2 text-[11px] text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>No mapa</span><span className="font-semibold text-foreground">{withCoords}</span></div>
            <div className="flex justify-between"><span>Sem coordenadas</span><span className="font-semibold text-foreground">{withoutCoords}</span></div>
            <div className="flex justify-between"><span>Sem CEP</span><span className="font-semibold text-foreground">{withoutCep}</span></div>
            <div className="flex justify-between"><span>Sem endereço</span><span className="font-semibold text-foreground">{withoutAddress}</span></div>
          </div>

          <Button
            className="btn-gradient h-9"
            disabled={enriching}
            onClick={() => enrichMut.mutate()}
          >
            {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Enriquecer todos (CEP + Endereço)
          </Button>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Busca via Receita Federal → ViaCEP → OpenStreetMap para cada CNPJ sem endereço completo.
          </p>

          <div className="-mx-1 flex-1 overflow-y-auto px-1 max-h-[40vh] lg:max-h-[calc(100vh-380px)]">
            {selectedBairro && (
              <button
                className="mb-2 w-full rounded-md border border-border/60 px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-accent"
                onClick={() => setSelectedBairro(null)}
              >
                ← Mostrar todos os bairros
              </button>
            )}
            <ul className="space-y-1">
              {grouped.map(([bairro, items]) => {
                const active = selectedBairro === bairro;
                const color = bairroColor(bairro);
                return (
                  <li key={bairro}>
                    <button
                      onClick={() => setSelectedBairro(active ? null : bairro)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs transition ${
                        active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                          style={{ background: color }}
                        />
                        <span className="truncate font-medium">{bairro}</span>
                      </span>
                      <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px]">
                        {items.length}
                      </Badge>
                    </button>
                  </li>
                );
              })}
              {grouped.length === 0 && (
                <li className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                  Nenhum lead encontrado.
                </li>
              )}
            </ul>
          </div>
        </aside>

        {/* Map */}
        <section className="surface-card overflow-hidden p-0 h-[60vh] min-h-[360px] lg:h-[calc(100vh-200px)] lg:min-h-[480px]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mapa…
            </div>
          ) : withCoords === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-md text-sm text-muted-foreground">
                Nenhum lead possui coordenadas ainda. Use <strong>Enriquecer todos</strong> para
                buscar endereço completo, CEP e geolocalização automaticamente.
              </p>
              <Button onClick={() => enrichMut.mutate()} disabled={enriching} className="btn-gradient h-9">
                {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Enriquecer agora
              </Button>
            </div>
          ) : (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Carregando mapa…</div>}>
              <TasksMap points={filtered} selectedBairro={selectedBairro} onSelectBairro={setSelectedBairro} />
            </Suspense>
          )}
        </section>

        {/* Missing address list */}
        <aside className="surface-card flex flex-col gap-2 p-3 xl:col-auto lg:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sem endereço / CEP
            </h3>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {missingList.length}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Leads que ainda não têm endereço completo cadastrado.
          </p>
          <ol className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1 max-h-[50vh] lg:max-h-[calc(100vh-260px)]">
            {missingList.map((p, i) => (
              <li
                key={p.cnpj + i}
                className="rounded-md border border-border/60 p-2 text-xs hover:bg-accent/40"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.company}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      CNPJ {p.cnpj}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {!p.cep && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600">
                          Sem CEP
                        </span>
                      )}
                      {!p.logradouro && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600">
                          Sem endereço
                        </span>
                      )}
                      {(!p.lat || !p.lon) && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600">
                          Sem coordenadas
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {missingList.length === 0 && (
              <li className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                Todos os leads possuem endereço completo.
              </li>
            )}
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}