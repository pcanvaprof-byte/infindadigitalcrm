import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/tasks-map-api";
import { bairroColor } from "@/lib/tasks-map-api";

function makeIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:22px;height:22px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const coords = points.filter((p) => p.lat && p.lon).map((p) => [p.lat!, p.lon!] as [number, number]);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

interface Props {
  points: MapPoint[];
  selectedBairro: string | null;
  onSelectBairro: (b: string | null) => void;
}

export function TasksMap({ points, selectedBairro }: Props) {
  const visible = useMemo(
    () => points.filter((p) => p.lat && p.lon && (!selectedBairro || (p.bairro || "Sem bairro") === selectedBairro)),
    [points, selectedBairro],
  );
  const mapRef = useRef<L.Map | null>(null);

  return (
    <MapContainer
      center={[-14.235, -51.9253]}
      zoom={4}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      ref={(m) => { if (m) mapRef.current = m; }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={visible} />
      {visible.map((p) => {
        const color = bairroColor(p.bairro);
        const addr = [p.logradouro, p.numero, p.bairro, p.cidade, p.uf].filter(Boolean).join(", ");
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
        return (
          <Marker key={p.cnpj} position={[p.lat!, p.lon!]} icon={makeIcon(color)}>
            <Popup>
              <div style={{ fontFamily: "inherit", fontSize: 12, minWidth: 200 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.company}</div>
                <div style={{ color: "#666", marginBottom: 6 }}>{addr || "—"}</div>
                {p.whatsapp && <div>📱 {p.whatsapp}</div>}
                {p.phone && <div>☎️ {p.phone}</div>}
                {p.email && <div>✉️ {p.email}</div>}
                <div style={{ marginTop: 6 }}>
                  <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                    Rotas →
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}