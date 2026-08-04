import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/tasks-map-api";
import { bairroColor } from "@/lib/tasks-map-api";
import type { Visit } from "@/lib/visits/api";
import { visitColor } from "@/lib/visits/api";
import { wazeUrl, type LatLng } from "@/lib/visits/route";

function makeIcon(color: string, label?: string, highlight = false) {
  const inner = label
    ? `<span style="transform:rotate(45deg);display:block;font:600 10px/1 system-ui;color:#fff;">${label}</span>`
    : "";
  
  const pulse = highlight 
    ? `animation: pin-pulse 1.5s infinite ease-in-out; outline: 3px solid ${color}; outline-offset: 2px; z-index: 1000;` 
    : "";

  return L.divIcon({
    className: "",
    html: `
      <style>
        @keyframes pin-pulse {
          0% { transform: rotate(-45deg) scale(1); box-shadow: 0 0 0 0 rgba(0,0,0,0.4); }
          50% { transform: rotate(-45deg) scale(1.2); box-shadow: 0 0 15px 5px rgba(0,0,0,0.2); }
          100% { transform: rotate(-45deg) scale(1); box-shadow: 0 0 0 0 rgba(0,0,0,0.4); }
        }
      </style>
      <div style="
        width:22px;height:22px;border-radius:50% 50% 50% 0;
        display:flex;align-items:center;justify-content:center;
        background:${color};transform:rotate(-45deg);
        border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);
        ${pulse}">${inner}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

function meIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#0ea5e9;border:3px solid white;box-shadow:0 0 0 4px rgba(14,165,233,.25);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
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
  visits?: Record<string, Visit>;
  colorMode?: "status" | "bairro";
  route?: MapPoint[];
  origin?: LatLng | null;
  onCheckin?: (p: MapPoint) => void;
  highlightQuery?: string;
}

const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");

export function TasksMap({
  points,
  selectedBairro,
  visits = {},
  colorMode = "status",
  route = [],
  origin = null,
  onCheckin,
  highlightQuery = "",
}: Props) {
  const visible = useMemo(
    () => points.filter((p) => p.lat && p.lon && (!selectedBairro || (p.bairro || "Sem bairro") === selectedBairro)),
    [points, selectedBairro],
  );
  const routeOrder = useMemo(() => {
    const m = new Map<string, number>();
    route.forEach((p, i) => m.set(digits(p.cnpj), i + 1));
    return m;
  }, [route]);
  const routeLine = useMemo(() => {
    const coords = route
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => [p.lat!, p.lon!] as [number, number]);
    return origin ? [[origin.lat, origin.lon] as [number, number], ...coords] : coords;
  }, [route, origin]);
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
      <FitBounds points={route.length ? route : visible} />
      {routeLine.length > 1 && (
        <Polyline positions={routeLine} pathOptions={{ color: "#0ea5e9", weight: 3, opacity: 0.7, dashArray: "6 6" }} />
      )}
      {origin && <Marker position={[origin.lat, origin.lon]} icon={meIcon()} />}
      {visible.map((p) => {
        const visit = visits[digits(p.cnpj)];
        const color =
          colorMode === "bairro" ? bairroColor(p.bairro) : visitColor(visit?.status);
        const order = routeOrder.get(digits(p.cnpj));
        const addr = [p.logradouro, p.numero, p.bairro, p.cidade, p.uf].filter(Boolean).join(", ");
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
        const isHighlighted = highlightQuery.length > 2 && 
          (p.nicho || "").toLowerCase().includes(highlightQuery.toLowerCase());
          
        return (
          <Marker 
            key={p.cnpj} 
            position={[p.lat!, p.lon!]} 
            icon={makeIcon(color, order ? String(order) : undefined, isHighlighted)}
            zIndexOffset={isHighlighted ? 1000 : 0}
          >
            <Popup>
              <div style={{ fontFamily: "inherit", fontSize: 12, minWidth: 200 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.company}</div>
                <div style={{ color: "#666", marginBottom: 6 }}>{addr || "—"}</div>
                <div style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: color,
                      color: "#fff",
                      fontSize: 10,
                    }}
                  >
                    {visit?.status ?? "Não visitado"}
                  </span>
                  {visit?.visited_at && (
                    <span style={{ color: "#888", marginLeft: 6, fontSize: 10 }}>
                      {new Date(visit.visited_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                {visit?.observacoes && (
                  <div style={{ color: "#555", marginBottom: 6 }}>“{visit.observacoes}”</div>
                )}
                {p.whatsapp && <div>📱 {p.whatsapp}</div>}
                {p.phone && <div>☎️ {p.phone}</div>}
                {p.email && <div>✉️ {p.email}</div>}
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                    Rotas
                  </a>
                  <a href={wazeUrl(p)} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                    Waze
                  </a>
                  {onCheckin && (
                    <button
                      type="button"
                      onClick={() => onCheckin(p)}
                      style={{
                        border: "none",
                        background: "#16a34a",
                        color: "#fff",
                        borderRadius: 6,
                        padding: "3px 8px",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      Check-in
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}