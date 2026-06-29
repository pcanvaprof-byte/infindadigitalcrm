/**
 * Configurações persistidas para o cálculo de probabilidade do bloco Previsão.
 * Mantém o número estável entre períodos (a janela histórica é sempre 90d por padrão)
 * e permite ao usuário ajustar o fallback exibido quando não há histórico suficiente.
 */
export interface ForecastSettings {
  /** Probabilidade aplicada quando não há histórico suficiente (0–1). Default 0.25. */
  fallback: number;
  /** Janela histórica em dias para calcular a taxa real. Default 90. */
  windowDays: number;
  /** Mínimo de propostas na janela para confiar na taxa histórica. Default 5. */
  minSample: number;
}

export const DEFAULT_FORECAST_SETTINGS: ForecastSettings = {
  fallback: 0.25,
  windowDays: 90,
  minSample: 5,
};

const STORAGE_KEY = "bi.forecast.settings.v1";

function clampProb(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_FORECAST_SETTINGS.fallback;
  if (n <= 0) return 0.01;
  if (n > 1) return 1;
  return Math.round(n * 100) / 100;
}

export function getForecastSettings(): ForecastSettings {
  if (typeof window === "undefined") return DEFAULT_FORECAST_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FORECAST_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ForecastSettings>;
    return {
      fallback: clampProb(Number(parsed.fallback ?? DEFAULT_FORECAST_SETTINGS.fallback)),
      windowDays: Math.max(7, Math.min(365, Math.round(Number(parsed.windowDays ?? DEFAULT_FORECAST_SETTINGS.windowDays)))),
      minSample: Math.max(1, Math.min(100, Math.round(Number(parsed.minSample ?? DEFAULT_FORECAST_SETTINGS.minSample)))),
    };
  } catch {
    return DEFAULT_FORECAST_SETTINGS;
  }
}

export function saveForecastSettings(next: Partial<ForecastSettings>) {
  if (typeof window === "undefined") return;
  const current = getForecastSettings();
  const merged: ForecastSettings = {
    fallback: clampProb(Number(next.fallback ?? current.fallback)),
    windowDays: Math.max(7, Math.min(365, Math.round(Number(next.windowDays ?? current.windowDays)))),
    minSample: Math.max(1, Math.min(100, Math.round(Number(next.minSample ?? current.minSample)))),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  // Notifica componentes locais (mesma aba) — `storage` event só dispara entre abas.
  window.dispatchEvent(new CustomEvent("bi-forecast-settings-changed", { detail: merged }));
}

export const FORECAST_SETTINGS_EVENT = "bi-forecast-settings-changed";