import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Sparkles, Search, Phone, MessageCircle } from "lucide-react";
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

  // Fila de tarefas: primeiros 150 com telefone/whatsapp cadastrado.
  const taskQueue = useMemo(() => {
    const onlyDigits = (s?: string | null) => (s || "").replace(/\D/g, "");
    return filtered
      .filter((p) => onlyDigits(p.whatsapp).length >= 10 || onlyDigits(p.phone).length >= 10)
      .slice(0, 150);
  }, [filtered]);

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
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_1fr_320px] lg:grid-cols-[280px_1fr]">
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

          <div className="-mx-1 flex-1 overflow-y-auto px-1 max-h-[40vh] lg:max-h-[calc(100vh-260px)]">
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

        {/* Fila de tarefas */}
        <aside className="surface-card flex flex-col gap-2 p-3 xl:col-auto lg:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fila de contatos
            </h3>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {taskQueue.length}/150
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Primeiros 150 leads com telefone cadastrado.
          </p>
          <ol className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1 max-h-[50vh] lg:max-h-[calc(100vh-260px)]">
            {taskQueue.map((p, i) => {
              const phone = (p.whatsapp || p.phone || "").replace(/\D/g, "");
              const wa = phone.length >= 10 ? `https://wa.me/55${phone}` : null;
              const tel = phone.length >= 10 ? `tel:+55${phone}` : null;
              return (
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
                        {p.bairro || p.cidade || "—"}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 hover:bg-emerald-500/20"
                          >
                            <MessageCircle className="h-3 w-3" /> WhatsApp
                          </a>
                        )}
                        {tel && (
                          <a
                            href={tel}
                            className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                          >
                            <Phone className="h-3 w-3" /> Ligar
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            {taskQueue.length === 0 && (
              <li className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                Nenhum lead com telefone cadastrado.
              </li>
            )}
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}