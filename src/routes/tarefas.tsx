import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { loadMapPoints, bairroColor, type MapPoint } from "@/lib/tasks-map-api";
import { runEnrichment } from "@/lib/enrichment/api";
import { collectBairro } from "@/lib/enrichment/bairro";

const TasksMap = lazy(() => import("@/components/TasksMap").then((m) => ({ default: m.TasksMap })));

export const Route = createFileRoute("/tarefas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tarefas — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <TarefasPage />
    </RequireAuth>
  ),
});

function TarefasPage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBairro, setSelectedBairro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [collectingBairro, setCollectingBairro] = useState(false);

  const refresh = () => {
    setLoading(true);
    loadMapPoints()
      .then(setPoints)
      .catch((e) => toast.error(`Erro: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return points;
    return points.filter((p) =>
      [p.company, p.bairro, p.cidade, p.logradouro].filter(Boolean).join(" ").toLowerCase().includes(term),
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
  const withoutBairro = points.filter((p) => !p.bairro).length;

  const enrichMissing = async () => {
    const missing = points.filter((p) => !p.lat || !p.lon).slice(0, 50);
    if (!missing.length) return toast.info("Todos os leads já têm coordenadas.");
    setGeocoding(true);
    const tid = toast.loading(`Geocodificando 0/${missing.length}…`);
    let ok = 0;
    for (let i = 0; i < missing.length; i++) {
      try { await runEnrichment(missing[i].cnpj); ok++; } catch { /* ignore */ }
      toast.loading(`Geocodificando ${i + 1}/${missing.length}…`, { id: tid });
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim ~1 req/s
    }
    toast.success(`Concluído: ${ok}/${missing.length}`, { id: tid });
    setGeocoding(false);
    refresh();
  };

  const collectBairros = async () => {
    const missing = points.filter((p) => !p.bairro);
    if (!missing.length) return toast.info("Todos já têm bairro.");
    setCollectingBairro(true);
    const tid = toast.loading(`Coletando bairros 0/${missing.length}…`);
    let ok = 0;
    for (let i = 0; i < missing.length; i++) {
      try { await collectBairro(missing[i].cnpj); ok++; } catch { /* ignore */ }
      toast.loading(`Coletando bairros ${i + 1}/${missing.length}…`, { id: tid });
      await new Promise((r) => setTimeout(r, 250));
    }
    toast.success(`Bairros coletados: ${ok}/${missing.length}`, { id: tid });
    setCollectingBairro(false);
    refresh();
  };

  return (
    <AppShell title="Tarefas" subtitle="Mapa de leads cadastrados por bairro">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="surface-card flex flex-col gap-3 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empresa, bairro, rua…"
              className="h-9 pl-8 text-xs"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{withCoords} no mapa · {withoutCoords} sem geocode</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={geocoding || withoutCoords === 0}
              onClick={enrichMissing}
            >
              {geocoding
                ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                : <Sparkles className="mr-1 h-3 w-3" />}
              Geocodificar
            </Button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{withoutBairro} sem bairro</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={collectingBairro || withoutBairro === 0}
              onClick={collectBairros}
            >
              {collectingBairro
                ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                : <MapPin className="mr-1 h-3 w-3" />}
              Coletar bairros
            </Button>
          </div>

          <div className="-mx-1 flex-1 overflow-y-auto px-1" style={{ maxHeight: "calc(100vh - 260px)" }}>
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
        <section className="surface-card overflow-hidden p-0" style={{ height: "calc(100vh - 200px)", minHeight: 480 }}>
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mapa…
            </div>
          ) : withCoords === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-md text-sm text-muted-foreground">
                Nenhum lead tem coordenadas ainda. Use <strong>Geocodificar</strong> para enriquecer
                automaticamente (Receita Federal + ViaCEP + OpenStreetMap).
              </p>
              <Button onClick={enrichMissing} disabled={geocoding} className="btn-gradient h-9">
                {geocoding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Geocodificar agora
              </Button>
            </div>
          ) : (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Carregando mapa…</div>}>
              <TasksMap points={filtered} selectedBairro={selectedBairro} onSelectBairro={setSelectedBairro} />
            </Suspense>
          )}
        </section>
      </div>
    </AppShell>
  );
}