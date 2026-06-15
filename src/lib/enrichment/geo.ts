import type { EnrichedAddress, EnrichedLocation } from "./types";

export async function geocode(addr: EnrichedAddress): Promise<EnrichedLocation | null> {
  const parts = [
    addr.logradouro && addr.numero ? `${addr.logradouro}, ${addr.numero}` : addr.logradouro,
    addr.bairro,
    addr.cidade,
    addr.uf,
    addr.cep,
    "Brasil",
  ].filter(Boolean).join(", ");
  if (!parts) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(parts)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const arr = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!arr.length) return null;
  const r = arr[0];
  return { lat: Number(r.lat), lon: Number(r.lon), display_name: r.display_name };
}