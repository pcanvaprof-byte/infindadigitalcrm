import { CAD_TEMP_LABEL, type CadTemp } from "@/lib/cadencia/types";

export function TemperaturaBadge({ temp }: { temp: CadTemp }) {
  return <span className="text-xs">{CAD_TEMP_LABEL[temp]}</span>;
}