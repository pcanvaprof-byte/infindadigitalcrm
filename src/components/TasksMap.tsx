import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/tasks-map-api";
import { bairroColor } from "@/lib/tasks-map-api";
import type { Visit } from "@/lib/visits/api";
import { visitColor } from "@/lib/visits/api";
import { wazeUrl, type LatLng } from "@/lib/visits/route";

function makeIcon(color: string, label?: string, highlight = false, isBairroSelected = false) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const size = isMobile ? 28 : 22;
  const anchor = isMobile ? 14 : 11;
  const popupAnchor = isMobile ? -24 : -20;
  
  const inner = label
    ? `<span style="transform:rotate(45deg);display:block;font:600 ${isMobile ? '12px' : '10px'}/1 system-ui;color:#fff;">${label}</span>`
    : "";
  
  const pulse = highlight 
    ? `animation: pin-pulse 1.5s infinite ease-in-out; outline: 3px solid ${color}; outline-offset: 2px; z-index: 1000;` 
    : isBairroSelected
    ? `outline: 2px solid ${color}; outline-offset: 1px; z-index: 500; scale: 1.1;`
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
        width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
        display:flex;align-items:center;justify-content:center;
        background:${color};transform:rotate(-45deg);
        border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);
        ${pulse}">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, size],
    popupAnchor: [0, popupAnchor],
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

function FitBounds({ points, fitKey }: { points: MapPoint[], fitKey?: number }) {
  const map = useMap();
  useEffect(() => {
    const coords = points.filter((p) => p.lat && p.lon).map((p) => [p.lat!, p.lon!] as [number, number]);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [fitKey, map]); // Só re-enquadra quando fitKey mudar ou no mount
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
  fitKey?: number;
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
  fitKey = 0,
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
    <div className="h-full w-full relative">
      <style>{`
        .leaflet-popup-content-wrapper { padding: 0 !important; border-radius: 12px !important; overflow: hidden !important; }
        .leaflet-popup-content { margin: 0 !important; width: auto !important; }
        .leaflet-container { font-family: inherit !important; }
      `}</style>
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
      <FitBounds points={route.length ? route : visible} fitKey={fitKey} />
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
        const isBairroSelected = selectedBairro === (p.bairro || "Sem bairro");
          
        return (
          <Marker 
            key={`${p.cnpj}-${visible.indexOf(p)}`} 
            position={[p.lat!, p.lon!]} 

            icon={makeIcon(color, order ? String(order) : undefined, isHighlighted, isBairroSelected)}
            zIndexOffset={isHighlighted ? 1000 : isBairroSelected ? 500 : 0}
          >
            <Popup>
              <div className="p-4" style={{ fontFamily: "inherit", fontSize: 13, minWidth: 260, maxWidth: "calc(100vw - 80px)" }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.company}</div>
                <div style={{ color: "#666", marginBottom: 8, lineHeight: 1.4, fontSize: 'clamp(11px, 3.2vw, 13px)' }}>{addr || "—"}</div>
                {p.nicho && (
                  <div style={{ marginBottom: 6, maxWidth: "100%" }}>
                    <span
                      style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        verticalAlign: "bottom",
                        padding: "1px 8px",
                        borderRadius: 4,
                        background: "rgba(14, 165, 233, 0.1)",
                        color: "#0ea5e9",
                        fontSize: "clamp(10px, 2.5vw, 11px)",
                        lineHeight: 1.5,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        border: "1px solid rgba(14, 165, 233, 0.2)",
                      }}
                      title={p.nicho}
                    >
                      🏷️ {p.nicho}
                    </span>
                  </div>
                )}
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
                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", padding: "6px 4px", minWidth: 44, textAlign: 'center' }}>
                    Rotas
                  </a>
                  <a href={wazeUrl(p)} target="_blank" rel="noreferrer" style={{ color: "#2563eb", padding: "6px 4px", minWidth: 44, textAlign: 'center' }}>
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
                        borderRadius: 8,
                        padding: "6px 12px",
                        cursor: "pointer",
                        fontSize: 12,
                        minHeight: 36,
                        minWidth: 80,
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
    </div>
  );
}