import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Loader2,
  Sparkles,
  Search,
  Navigation,
  WifiOff,
  CloudUpload,
} from "lucide-react";
import { toast } from "sonner";
import { loadMapPoints, bairroColor, type MapPoint } from "@/lib/tasks-map-api";
import { runEnrichment } from "@/lib/enrichment/api";
import { crmKeys } from "@/lib/crm/api";
import {
  loadLatestVisitsByCnpj,
  visitKeys,
  visitColor,
  flushVisitQueue,
} from "@/lib/visits/api";
import { isOnline, queueSize } from "@/lib/visits/offline";
import {
  getCurrentPosition,
  googleMapsRouteUrl,
  orderByNearest,
  routeDistanceKm,
  saveRouteCache,
  readRouteCache,
  MAX_WAYPOINTS,
  type LatLng,
} from "@/lib/visits/route";
import { VisitCheckinDialog } from "@/components/VisitCheckinDialog";

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

const BATCH_SIZE = 20;
const ROUTE_SIZE = 15;
const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");

function MapaPage() {
  const qc = useQueryClient();
  const [selectedBairro, setSelectedBairro] = useState<string | null>(null);
  const [selectedNicho, setSelectedNicho] = useState<string>("all");
  const [uf, setUf] = useState<string>("all");
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<MapPoint[]>([]);
  const [routing, setRouting] = useState(false);
  const [routedCnpjs, setRoutedCnpjs] = useState<string[]>([]);
  const [checkinPoint, setCheckinPoint] = useState<MapPoint | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingQueue, setPendingQueue] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(20);

  const pointsQ = useQuery({
    queryKey: crmKeys.tasks,
    queryFn: loadMapPoints,
    staleTime: 15_000,
  });
  const points: MapPoint[] = pointsQ.data ?? [];
  const loading = pointsQ.isLoading;

  const visitsQ = useQuery({
    queryKey: visitKeys.all,
    queryFn: loadLatestVisitsByCnpj,
    staleTime: 15_000,
  });
  const visits = visitsQ.data ?? {};

  // ---- estado de conexão + fila offline ----
  useEffect(() => {
    const sync = () => {
      setOnline(isOnline());
      setPendingQueue(queueSize());
    };
    sync();
    const onQueue = () => setPendingQueue(queueSize());
    const goOnline = async () => {
      setOnline(true);
      const sent = await flushVisitQueue();
      setPendingQueue(queueSize());
      if (sent > 0) {
        toast.success(`${sent} check-in(s) offline enviados.`);
        qc.invalidateQueries({ queryKey: visitKeys.all });
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", sync);
    window.addEventListener("pap-visits-queue:changed", onQueue);
    void goOnline();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", sync);
      window.removeEventListener("pap-visits-queue:changed", onQueue);
    };
  }, [qc]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: crmKeys.tasks });
    qc.invalidateQueries({ queryKey: crmKeys.prospects });
    qc.invalidateQueries({ queryKey: visitKeys.all });
  };

  const enrichMut = useMutation({
    mutationFn: async () => {
      const pending = points.filter((p) => !p.cep || !p.logradouro || !p.lat || !p.lon);
      if (!pending.length) {
        toast.info("Todos os leads já possuem endereço completo e coordenadas.");
        return 0;
      }
      // processa em lotes de 20 por execução
      const batch = pending.slice(0, BATCH_SIZE);
      const restante = pending.length - batch.length;
      const tid = toast.loading(`Enriquecendo 0/${batch.length}…`);
      let ok = 0;
      for (let i = 0; i < batch.length; i++) {
        try {
          await runEnrichment(batch[i].cnpj);
          ok++;
        } catch {
          /* segue para o próximo */
        }
        toast.loading(`Enriquecendo ${i + 1}/${batch.length}…`, { id: tid });
        await new Promise((r) => setTimeout(r, 1100));
      }
      toast.success(
        restante > 0
          ? `Lote concluído: ${ok}/${batch.length} · ${restante} pendente(s). Clique novamente para o próximo lote.`
          : `Concluído: ${ok}/${batch.length}`,
        { id: tid },
      );
      return ok;
    },
    onSuccess: refresh,
  });

  const enriching = enrichMut.isPending;

  const ufOptions = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of points) {
      const key = (p.uf || "").trim().toUpperCase();
      if (!key) continue;
      set.set(key, (set.get(key) ?? 0) + 1);
    }
    return Array.from(set.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [points]);

  const nichoOptions = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of points) {
      const key = (p.nicho || "Outros").trim();
      set.set(key, (set.get(key) ?? 0) + 1);
    }
    return Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
  }, [points]);

  const byUf = useMemo(() => {
    let result = uf === "all" ? points : points.filter((p) => (p.uf || "").trim().toUpperCase() === uf);
    if (selectedNicho !== "all") {
      result = result.filter((p) => (p.nicho || "Outros").trim() === selectedNicho);
    }
    return result;
  }, [points, uf, selectedNicho]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return byUf;
    return byUf.filter((p) =>
      [p.company, p.bairro, p.cidade, p.logradouro, p.cep, p.cnpj, p.nicho]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [byUf, q]);

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

  // ---- roteiro do dia ----
  // respeita o bairro selecionado no mapa/lista
  const scoped = useMemo(
    () =>
      selectedBairro
        ? filtered.filter((p) => (p.bairro || "Sem bairro") === selectedBairro)
        : filtered,
    [filtered, selectedBairro],
  );

  const routeCandidates = useMemo(
    () =>
      scoped.filter((p) => {
        if (p.lat == null || p.lon == null) return false;
        const v = visits[digits(p.cnpj)];
        if (!v) return true;
        if (v.status === "Fechado" || v.status === "Sem sucesso") return false;
        if (v.status === "Reagendar") {
          return !v.retornar_em || v.retornar_em <= new Date().toISOString().slice(0, 10);
        }
        return false; // já visitado
      }),
    [scoped, visits],
  );

  const remainingCandidates = useMemo(
    () => routeCandidates.filter((p) => !routedCnpjs.includes(digits(p.cnpj))),
    [routeCandidates, routedCnpjs],
  );

  const buildRoute = async (next = false) => {
    setRouting(true);
    try {
      const pool = next ? remainingCandidates : routeCandidates;
      if (!pool.length) {
        toast.info(
          next
            ? "Não há mais leads pendentes nesse filtro."
            : "Nenhum lead pendente de visita com coordenadas nesse filtro.",
        );
        return;
      }
      let from = origin;
      const last = next ? route[route.length - 1] : null;
      if (last?.lat != null && last?.lon != null) {
        from = { lat: last.lat, lon: last.lon };
      } else {
        try {
          from = await getCurrentPosition();
          setOrigin(from);
        } catch {
          if (!from) {
            const first = pool[0];
            from = { lat: first.lat!, lon: first.lon! };
            toast.info("Sem GPS: roteiro montado a partir do primeiro lead da lista.");
          }
        }
      }
      const ordered = orderByNearest(pool, from).slice(0, ROUTE_SIZE);
      if (!ordered.length) {
        toast.info("Nenhum lead pendente de visita com coordenadas nesse filtro.");
        return;
      }
      setRoute(ordered);
      setRoutedCnpjs((prev) =>
        next
          ? [...prev, ...ordered.map((p) => digits(p.cnpj))]
          : ordered.map((p) => digits(p.cnpj)),
      );
      saveRouteCache(ordered.map((p) => digits(p.cnpj)));
      toast.success(
        `${next ? "Próximo roteiro" : "Roteiro"} com ${ordered.length} paradas montado${
          selectedBairro ? ` em ${selectedBairro}` : ""
        }.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRouting(false);
    }
  };

  // restaura roteiro do dia (funciona offline)
  useEffect(() => {
    if (route.length || !points.length) return;
    const cached = readRouteCache();
    if (!cached.length) return;
    const byCnpj = new Map(points.map((p) => [digits(p.cnpj), p]));
    const restored = cached.map((c) => byCnpj.get(c)).filter(Boolean) as MapPoint[];
    if (restored.length) setRoute(restored);
  }, [points, route.length]);

  const routeKm = useMemo(() => routeDistanceKm(route, origin), [route, origin]);
  const routeUrl = useMemo(() => googleMapsRouteUrl(route, origin), [route, origin]);

  return (
    <AppShell title="Mapa" subtitle="Todos os leads prospectados com endereço completo e CEP">
      {(!online || pendingQueue > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          {!online ? (
            <>
              <WifiOff className="h-4 w-4" />
              Você está offline. O roteiro do dia continua disponível e os check-ins ficam salvos no aparelho.
            </>
          ) : (
            <>
              <CloudUpload className="h-4 w-4" />
              {pendingQueue} check-in(s) aguardando envio.
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={async () => {
                  const sent = await flushVisitQueue();
                  setPendingQueue(queueSize());
                  if (sent) {
                    toast.success(`${sent} check-in(s) enviados.`);
                    refresh();
                  } else toast.error("Ainda não foi possível enviar. Tente novamente.");
                }}
              >
                Enviar agora
              </Button>
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
        {/* Sidebar - Oculta em mobile por padrão ou colapsada */}
        <aside className="surface-card flex flex-col gap-3 p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-140px)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empresa, nicho, bairro…"
              className="h-11 pl-9 text-sm lg:h-9 lg:pl-8 lg:text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={uf}
                onValueChange={(v) => {
                  setUf(v);
                  setSelectedBairro(null);
                }}
              >
                <SelectTrigger className="h-11 text-sm lg:h-9 lg:text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {ufOptions.map(([code, count]) => (
                    <SelectItem key={code} value={code}>
                      {code} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedBairro ?? "all"}
                onValueChange={(v) => setSelectedBairro(v === "all" ? null : v)}
              >
                <SelectTrigger className="h-11 text-sm lg:h-9 lg:text-xs">
                  <SelectValue placeholder="Bairro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bairros</SelectItem>
                  {grouped.map(([bairro, items]) => (
                    <SelectItem key={bairro} value={bairro}>
                      {bairro} ({items.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select
              value={selectedNicho}
              onValueChange={(v) => {
                setSelectedNicho(v);
                setSelectedBairro(null);
              }}
            >
              <SelectTrigger className="h-11 text-sm lg:h-9 lg:text-xs">
                <SelectValue placeholder="Nicho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os nichos</SelectItem>
                {nichoOptions.map(([label, count]) => (
                  <SelectItem key={label} value={label}>
                    {label} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border/60 p-2 text-[11px] text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>No mapa</span><span className="font-semibold text-foreground">{withCoords}</span></div>
            <div className="flex justify-between"><span>Sem coordenadas</span><span className="font-semibold text-foreground">{withoutCoords}</span></div>
          </div>

          <div className="flex flex-col gap-1.5 mt-auto">
            <Button
              className="btn-gradient w-full h-11 lg:h-9"
              disabled={enriching}
              onClick={() => enrichMut.mutate()}
            >
              {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Enriquecer próximos 20
            </Button>
            <p className="text-[10px] text-muted-foreground leading-tight text-center">
              Processa em lotes de {BATCH_SIZE} CNPJs por vez.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-1 -mx-1 max-h-[300px] lg:max-h-[calc(100vh-320px)]">
            {selectedBairro && (
              <button
                className="mb-2 w-full rounded-md border border-border/60 px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-accent"
                onClick={() => setSelectedBairro(null)}
              >
                ← Mostrar todos os bairros
              </button>
            )}
            <ul className="space-y-1">
              {grouped.slice(0, displayLimit).map(([bairro, items]) => {
                const active = selectedBairro === bairro;
                const color = bairroColor(bairro);
                
                // Agrupa nichos únicos neste bairro para exibição rápida
                const niches = Array.from(new Set(items.map(p => p.nicho).filter(Boolean)));
                
                return (
                  <li key={bairro} className="space-y-1">
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
                        <span className="truncate font-medium whitespace-nowrap">{bairro}</span>
                      </span>
                      <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px]">
                        {items.length}
                      </Badge>
                    </button>
                    
                    {/* Exibição rápida dos nichos do bairro */}
                    {niches.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-6 pb-1 min-w-0">
                        {niches.slice(0, 3).map((n, i) => (
                          <span
                            key={i}
                            title={n ?? undefined}
                            className="max-w-[45%] sm:max-w-[110px] lg:max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap rounded-sm bg-muted/50 px-1 py-[1px] font-bold tracking-wider text-muted-foreground uppercase transition-all duration-200"
                            style={{ 
                              fontSize: 'clamp(8px, 2.2vw, 10px)',
                              lineHeight: '1rem'
                            }}
                          >
                            {n}
                          </span>
                        ))}
                        {niches.length > 3 && (
                          <span className="shrink-0 text-[10px] leading-4 lg:text-[11px] text-muted-foreground opacity-60">
                            +{niches.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              {grouped.length > displayLimit && (
                <li className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-[10px] h-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setDisplayLimit(prev => prev + 20)}
                  >
                    Ver mais bairros...
                  </Button>
                </li>
              )}
              {grouped.length === 0 && (
                <li className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                  Nenhum lead encontrado.
                </li>
              )}
            </ul>
          </div>
        </aside>

        {/* Map - Prioridade visual em mobile */}
        <section className="surface-card overflow-hidden p-0 h-[70vh] min-h-[400px] lg:h-[calc(100vh-200px)] lg:min-h-[480px] order-first lg:order-none">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mapa…
            </div>
          ) : withCoords === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-md text-sm text-muted-foreground">
                Nenhum lead possui coordenadas ainda. Use <strong>Enriquecer 20</strong> para
                buscar endereço completo, CEP e geolocalização automaticamente.
              </p>
              <Button onClick={() => enrichMut.mutate()} disabled={enriching} className="btn-gradient h-9">
                {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Enriquecer próximos 20
              </Button>
            </div>
          ) : (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Carregando mapa…</div>}>
              <TasksMap
                points={filtered}
                selectedBairro={selectedBairro}
                onSelectBairro={setSelectedBairro}
                visits={visits}
                colorMode="status"
                route={route}
                highlightQuery={q}
                origin={origin}
                onCheckin={setCheckinPoint}
              />
            </Suspense>
          )}
        </section>

      </div>

      {/* Roteiro do dia — abaixo do mapa */}
      <section className="surface-card mt-3 space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Roteiro do dia
            </h3>
            {route.length > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {route.length} paradas · {routeKm.toFixed(1)} km
              </Badge>
            )}
            {selectedBairro && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {selectedBairro}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-9 text-xs"
              disabled={routing || !online}
              onClick={() => buildRoute(false)}
            >
              {routing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="mr-2 h-4 w-4" />
              )}
              Montar roteiro ({Math.min(routeCandidates.length, ROUTE_SIZE)})
            </Button>
            {route.length > 0 && (
              <>
                <Button
                  variant="outline"
                  className="h-9 text-xs"
                  disabled={routing || !online || remainingCandidates.length === 0}
                  onClick={() => buildRoute(true)}
                >
                  Próximo roteiro ({Math.min(remainingCandidates.length, ROUTE_SIZE)})
                </Button>
                <Button asChild size="sm" className="btn-gradient h-9 text-[11px]">
                  <a href={routeUrl} target="_blank" rel="noreferrer">
                    Abrir no Maps
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 text-[11px]"
                  onClick={() => {
                    setRoute([]);
                    setRoutedCnpjs([]);
                  }}
                >
                  Limpar
                </Button>
              </>
            )}
          </div>
        </div>

        {route.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Monte o roteiro para ordenar as próximas paradas pela menor distância a partir da sua
            localização. Selecione um bairro na lista para roteirizar só aquele bairro.
          </p>
        ) : (
          <>
            <ol className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2 xl:grid-cols-3">
              {route.map((p, i) => {
                const v = visits[digits(p.cnpj)];
                return (
                  <li key={p.cnpj} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-accent/40">
                    <span
                      className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ background: visitColor(v?.status) }}
                    >
                      {i + 1}
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setCheckinPoint(p)}>
                      <span className="block truncate font-medium">{p.company}</span>
                      <span className="block truncate text-muted-foreground">
                        {[p.logradouro, p.numero, p.bairro].filter(Boolean).join(", ") || "—"}
                        {p.data_abertura && (
                          <span className="ml-2 font-normal">
                            • Abertura: {new Date(p.data_abertura).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {route.length > MAX_WAYPOINTS && (
              <p className="text-[10px] text-muted-foreground">
                O Google Maps aceita até {MAX_WAYPOINTS} paradas por rota.
              </p>
            )}
          </>
        )}
      </section>

      <VisitCheckinDialog
        point={checkinPoint}
        onClose={() => setCheckinPoint(null)}
        onSaved={() => {
          setPendingQueue(queueSize());
          qc.invalidateQueries({ queryKey: visitKeys.all });
        }}
      />
    </AppShell>
  );
}