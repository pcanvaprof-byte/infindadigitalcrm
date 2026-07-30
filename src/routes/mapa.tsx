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
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { loadMapPoints, bairroColor, type MapPoint } from "@/lib/tasks-map-api";
import { runEnrichment } from "@/lib/enrichment/api";
import { crmKeys } from "@/lib/crm/api";
import {
  loadLatestVisitsByCnpj,
  visitKeys,
  visitColor,
  VISIT_STATUSES,
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
  const [uf, setUf] = useState<string>("all");
  const [q, setQ] = useState("");
  const [missingUf, setMissingUf] = useState<string>("all");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<MapPoint[]>([]);
  const [routing, setRouting] = useState(false);
  const [checkinPoint, setCheckinPoint] = useState<MapPoint | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingQueue, setPendingQueue] = useState(0);

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
      const pending = points
        .filter((p) => !p.cep || !p.logradouro || !p.lat || !p.lon)
        .filter(
          (p) =>
            missingUf === "all" ||
            (p.uf || "").trim().toUpperCase() === missingUf,
        );
      if (!pending.length) {
        toast.info(
          missingUf === "all"
            ? "Todos os leads já possuem endereço completo e coordenadas."
            : `Nenhum lead pendente em ${missingUf}.`,
        );
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

  const byUf = useMemo(
    () =>
      uf === "all"
        ? points
        : points.filter((p) => (p.uf || "").trim().toUpperCase() === uf),
    [points, uf],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return byUf;
    return byUf.filter((p) =>
      [p.company, p.bairro, p.cidade, p.logradouro, p.cep, p.cnpj]
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
  const withoutCep = points.filter((p) => !p.cep).length;
  const withoutAddress = points.filter((p) => !p.logradouro).length;

  // ---- cobertura por status (leads filtrados) ----
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { "não visitado": 0 };
    for (const s of VISIT_STATUSES) counts[s] = 0;
    for (const p of filtered) {
      const st = visits[digits(p.cnpj)]?.status;
      const key = st && counts[st] !== undefined ? st : "não visitado";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [filtered, visits]);
  const visitedCount = filtered.length - (statusCounts["não visitado"] ?? 0);
  const coverage = filtered.length ? Math.round((visitedCount / filtered.length) * 100) : 0;

  // ---- roteiro do dia ----
  const routeCandidates = useMemo(
    () =>
      filtered.filter((p) => {
        if (p.lat == null || p.lon == null) return false;
        const v = visits[digits(p.cnpj)];
        if (!v) return true;
        if (v.status === "Fechado" || v.status === "Sem sucesso") return false;
        if (v.status === "Reagendar") {
          return !v.retornar_em || v.retornar_em <= new Date().toISOString().slice(0, 10);
        }
        return false; // já visitado
      }),
    [filtered, visits],
  );

  const buildRoute = async () => {
    setRouting(true);
    try {
      let from = origin;
      try {
        from = await getCurrentPosition();
        setOrigin(from);
      } catch {
        if (!from) {
          const first = routeCandidates[0];
          if (!first) throw new Error("Nenhum lead disponível para roteirizar.");
          from = { lat: first.lat!, lon: first.lon! };
          toast.info("Sem GPS: roteiro montado a partir do primeiro lead da lista.");
        }
      }
      const ordered = orderByNearest(routeCandidates, from).slice(0, ROUTE_SIZE);
      if (!ordered.length) {
        toast.info("Nenhum lead pendente de visita com coordenadas nesse filtro.");
        return;
      }
      setRoute(ordered);
      saveRouteCache(ordered.map((p) => digits(p.cnpj)));
      toast.success(`Roteiro com ${ordered.length} paradas montado.`);
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

  const missingAll = useMemo(
    () => points.filter((p) => !p.cep || !p.logradouro),
    [points],
  );

  const missingUfOptions = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of missingAll) {
      const key = (p.uf || "").trim().toUpperCase() || "—";
      set.set(key, (set.get(key) ?? 0) + 1);
    }
    return Array.from(set.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [missingAll]);

  const matchMissingUf = (p: MapPoint) =>
    missingUf === "all" ||
    ((p.uf || "").trim().toUpperCase() || "—") === missingUf;

  const pendingCount = points.filter(
    (p) => (!p.cep || !p.logradouro || !p.lat || !p.lon) && matchMissingUf(p),
  ).length;

  const missingList = useMemo(
    () => missingAll.filter(matchMissingUf).slice(0, 200),
    [missingAll, missingUf],
  );

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

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={uf}
              onValueChange={(v) => {
                setUf(v);
                setSelectedBairro(null);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
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
              <SelectTrigger className="h-9 text-xs">
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

          <div className="rounded-md border border-border/60 p-2 text-[11px] text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>No mapa</span><span className="font-semibold text-foreground">{withCoords}</span></div>
            <div className="flex justify-between"><span>Sem coordenadas</span><span className="font-semibold text-foreground">{withoutCoords}</span></div>
            <div className="flex justify-between"><span>Sem CEP</span><span className="font-semibold text-foreground">{withoutCep}</span></div>
            <div className="flex justify-between"><span>Sem endereço</span><span className="font-semibold text-foreground">{withoutAddress}</span></div>
          </div>

          {/* Cobertura + legenda de status */}
          <div className="rounded-md border border-border/60 p-2 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                Cobertura
              </span>
              <span className="font-semibold text-foreground">
                {visitedCount}/{filtered.length} ({coverage}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${coverage}%` }} />
            </div>
            <ul className="space-y-0.5 pt-1">
              {["não visitado", ...VISIT_STATUSES].map((s) => (
                <li key={s} className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: visitColor(s === "não visitado" ? null : s) }}
                    />
                    <span className="capitalize">{s}</span>
                  </span>
                  <span className="font-medium text-foreground">{statusCounts[s] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Roteiro do dia */}
          <div className="rounded-md border border-border/60 p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Roteiro do dia
              </span>
              {route.length > 0 && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {route.length} paradas · {routeKm.toFixed(1)} km
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              className="h-9 w-full text-xs"
              disabled={routing || !online}
              onClick={buildRoute}
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
                <ol className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
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
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setCheckinPoint(p)}
                        >
                          <span className="block truncate font-medium">{p.company}</span>
                          <span className="block truncate text-muted-foreground">
                            {[p.logradouro, p.numero, p.bairro].filter(Boolean).join(", ") || "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex gap-2">
                  <Button asChild size="sm" className="btn-gradient h-8 flex-1 text-[11px]">
                    <a href={routeUrl} target="_blank" rel="noreferrer">
                      Abrir no Maps
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-[11px]"
                    onClick={() => setRoute([])}
                  >
                    Limpar
                  </Button>
                </div>
                {route.length > MAX_WAYPOINTS && (
                  <p className="text-[10px] text-muted-foreground">
                    O Google Maps aceita até {MAX_WAYPOINTS} paradas por rota.
                  </p>
                )}
              </>
            )}
          </div>

          <Button
            className="btn-gradient h-9"
            disabled={enriching}
            onClick={() => enrichMut.mutate()}
          >
            {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Enriquecer 20 (CEP + Endereço)
          </Button>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Processa em lotes de {BATCH_SIZE} CNPJs por vez (Receita Federal → ViaCEP → OpenStreetMap).
            {pendingCount > 0 ? ` ${pendingCount} lead(s) pendente(s).` : " Nenhum lead pendente."}
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
                origin={origin}
                onCheckin={setCheckinPoint}
              />
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
          <Select value={missingUf} onValueChange={setMissingUf}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Todos os estados ({missingAll.length})
              </SelectItem>
              {missingUfOptions.map(([code, count]) => (
                <SelectItem key={code} value={code}>
                  {code === "—" ? "Sem UF" : code} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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