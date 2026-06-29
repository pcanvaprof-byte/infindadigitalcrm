import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, Settings2, Info, History } from "lucide-react";
import {
  DEFAULT_FORECAST_SETTINGS,
  FORECAST_SETTINGS_EVENT,
  getForecastSettings,
  saveForecastSettings,
  type ForecastSettings,
} from "@/lib/bi/forecast-settings";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  recorrencia: number;
  fechado: number;
  pipelineAberto: number;
  /** Probabilidade média do pipeline (0–1). */
  pipelineProbabilidade?: number;
  /** Origem da probabilidade — controla o badge exibido. */
  probabilidadeSource?: "historico" | "fallback";
  /** Motivo curto quando caímos no fallback. */
  probabilidadeMotivo?: string;
  /** Amostra dos últimos N dias (histórico). */
  amostra?: {
    janelaDias: number;
    contratosRecentes: number;
    propostasRecentes: number;
    minimoAmostra: number;
    fallbackAplicado: number;
  };
  meta: number;
  /** Label do período ativo (ex: "Este mês", "Hoje"). Default "mês". */
  periodLabel?: string;
  /** Descrição do range (ex: "01/06 → 28/06"). Opcional. */
  rangeLabel?: string;
}

export function PrevisaoPanel({
  recorrencia, fechado, pipelineAberto, pipelineProbabilidade,
  probabilidadeSource, probabilidadeMotivo, amostra,
  meta, periodLabel, rangeLabel,
}: Props) {
  const [settings, setSettings] = useState<ForecastSettings>(() => getForecastSettings());
  useEffect(() => {
    const reload = () => setSettings(getForecastSettings());
    window.addEventListener(FORECAST_SETTINGS_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(FORECAST_SETTINGS_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const prob = pipelineProbabilidade && pipelineProbabilidade > 0
    ? pipelineProbabilidade
    : settings.fallback;
  const pipelinePonderado = Math.round(pipelineAberto * prob);
  const projecao = recorrencia + fechado + pipelinePonderado;
  const gap = Math.max(0, meta - projecao);
  const probabilidadeMeta = meta > 0 ? Math.min(100, Math.round((projecao / meta) * 100)) : 0;
  const scope = periodLabel ?? "mês";
  const isFallback = probabilidadeSource === "fallback";
  const janelaDias = amostra?.janelaDias ?? settings.windowDays;

  const items = [
    { label: "Recorrência",       value: fmtBRL(recorrencia),       tone: "text-emerald-400" },
    { label: "Receita fechada",   value: fmtBRL(fechado),           tone: "text-primary" },
    { label: "Pipeline aberto",   value: fmtBRL(pipelineAberto),    tone: "text-sky-400" },
    { label: `Projeção (${scope})`, value: fmtBRL(projecao),        tone: "text-foreground" },
    { label: "Gap p/ meta",       value: fmtBRL(gap),               tone: gap > 0 ? "text-rose-400" : "text-emerald-400" },
    { label: "Probabilidade",     value: `${probabilidadeMeta}%`,   tone: probabilidadeMeta >= 100 ? "text-emerald-400" : probabilidadeMeta >= 85 ? "text-amber-400" : "text-rose-400" },
  ];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
            <TrendingUp className="h-3.5 w-3.5" /> Previsão · {scope}
            {rangeLabel ? <span className="ml-1 text-[10px] normal-case tracking-normal text-muted-foreground">({rangeLabel})</span> : null}
          </div>
          <div className="flex items-center gap-1.5">
            {probabilidadeSource && (
              <Badge
                variant={isFallback ? "outline" : "secondary"}
                className={`gap-1 text-[10px] ${isFallback ? "border-amber-500/40 text-amber-300" : "border-emerald-500/40 text-emerald-300"}`}
                title={probabilidadeMotivo ?? `Taxa real dos últimos ${janelaDias} dias`}
              >
                {isFallback ? <Info className="h-3 w-3" /> : <History className="h-3 w-3" />}
                {isFallback ? "Fallback" : `Histórico ${janelaDias}d`}
              </Badge>
            )}
            <ForecastSettingsPopover current={settings} onSaved={setSettings} />
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Projeção = recorrência + receita fechada + pipeline × {Math.round(prob * 100)}%.
        </p>
        {isFallback && (
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
            <Info className="mr-1 inline h-3 w-3" />
            {probabilidadeMotivo ?? `Sem histórico suficiente nos últimos ${janelaDias} dias.`}
            {amostra ? (
              <span className="ml-1 text-amber-200/70">
                ({amostra.contratosRecentes} contratos / {amostra.propostasRecentes} propostas · mín. {amostra.minimoAmostra})
              </span>
            ) : null}
            <span className="ml-1 text-amber-200/70">
              Probabilidade fixa em {Math.round(prob * 100)}% para evitar oscilação entre períodos.
            </span>
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-xl border border-border bg-card/60 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${it.tone}`}>{it.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastSettingsPopover({
  current,
  onSaved,
}: {
  current: ForecastSettings;
  onSaved: (s: ForecastSettings) => void;
}) {
  const [fallbackPct, setFallbackPct] = useState(String(Math.round(current.fallback * 100)));
  const [windowDays, setWindowDays] = useState(String(current.windowDays));
  const [minSample, setMinSample] = useState(String(current.minSample));

  useEffect(() => {
    setFallbackPct(String(Math.round(current.fallback * 100)));
    setWindowDays(String(current.windowDays));
    setMinSample(String(current.minSample));
  }, [current]);

  const handleSave = () => {
    saveForecastSettings({
      fallback: Number(fallbackPct) / 100,
      windowDays: Number(windowDays),
      minSample: Number(minSample),
    });
    onSaved(getForecastSettings());
  };
  const handleReset = () => {
    saveForecastSettings(DEFAULT_FORECAST_SETTINGS);
    onSaved(DEFAULT_FORECAST_SETTINGS);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Configurar probabilidade">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Probabilidade do pipeline</p>
          <p className="text-[11px] text-muted-foreground">
            Quando não houver histórico suficiente na janela, este fallback é aplicado para
            manter a probabilidade estável entre Hoje/Semana/Mês/Trimestre.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="fc-fb" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Fallback %
            </Label>
            <Input
              id="fc-fb"
              type="number"
              min={1}
              max={100}
              value={fallbackPct}
              onChange={(e) => setFallbackPct(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fc-wd" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Janela (d)
            </Label>
            <Input
              id="fc-wd"
              type="number"
              min={7}
              max={365}
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fc-ms" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Mín. propostas
            </Label>
            <Input
              id="fc-ms"
              type="number"
              min={1}
              max={100}
              value={minSample}
              onChange={(e) => setMinSample(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
            Restaurar padrão
          </Button>
          <Button size="sm" onClick={handleSave}>Salvar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}