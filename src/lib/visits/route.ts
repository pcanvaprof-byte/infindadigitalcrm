import type { MapPoint } from "@/lib/tasks-map-api";

export interface LatLng {
  lat: number;
  lon: number;
}

/** Distância aproximada em km (Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ordena os pontos pelo vizinho mais próximo, partindo de `origin`. */
export function orderByNearest(points: MapPoint[], origin: LatLng): MapPoint[] {
  const pool = points.filter((p) => p.lat != null && p.lon != null);
  const out: MapPoint[] = [];
  let cur = origin;
  while (pool.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const d = distanceKm(cur, { lat: pool[i].lat!, lon: pool[i].lon! });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = pool.splice(bestIdx, 1);
    out.push(next);
    cur = { lat: next.lat!, lon: next.lon! };
  }
  return out;
}

/** Distância total do roteiro em km. */
export function routeDistanceKm(route: MapPoint[], origin?: LatLng | null): number {
  let total = 0;
  let cur = origin ?? (route[0] ? { lat: route[0].lat!, lon: route[0].lon! } : null);
  if (!cur) return 0;
  for (const p of route) {
    if (p.lat == null || p.lon == null) continue;
    total += distanceKm(cur, { lat: p.lat, lon: p.lon });
    cur = { lat: p.lat, lon: p.lon };
  }
  return total;
}

/** Google Maps aceita no máximo ~23 waypoints intermediários. */
export const MAX_WAYPOINTS = 23;

export function googleMapsRouteUrl(route: MapPoint[], origin?: LatLng | null): string {
  const pts = route.filter((p) => p.lat != null && p.lon != null).slice(0, MAX_WAYPOINTS + 1);
  if (!pts.length) return "";
  const coord = (p: MapPoint) => `${p.lat},${p.lon}`;
  const destination = coord(pts[pts.length - 1]);
  const waypoints = pts.slice(0, -1).map(coord).join("|");
  const params = new URLSearchParams({ api: "1", destination, travelmode: "driving" });
  if (origin) params.set("origin", `${origin.lat},${origin.lon}`);
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function wazeUrl(p: MapPoint): string {
  return `https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes`;
}

export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalização indisponível neste dispositivo."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Não foi possível obter sua localização.")),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

const ROUTE_CACHE = "pap.route.today.v1";

export function saveRouteCache(cnpjs: string[]) {
  try {
    localStorage.setItem(
      ROUTE_CACHE,
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), cnpjs }),
    );
  } catch {
    /* ignore */
  }
}

export function readRouteCache(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ROUTE_CACHE) || "null") as
      | { date: string; cnpjs: string[] }
      | null;
    if (!raw) return [];
    if (raw.date !== new Date().toISOString().slice(0, 10)) return [];
    return raw.cnpjs ?? [];
  } catch {
    return [];
  }
}