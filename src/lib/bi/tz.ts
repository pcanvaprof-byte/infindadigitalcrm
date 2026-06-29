import { supabase as sb } from "@/integrations/supabase/client";

/**
 * Formata uma Date como timestamp local com offset (`YYYY-MM-DDTHH:mm:ss±HH:MM`).
 * Evita o "timezone drift" causado por `.toISOString()` (que converte para UTC e
 * pode pular registros gravados nas primeiras horas do dia em fusos como UTC-3).
 */
export function localTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset(); // minutes east of UTC
  const sign = off >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${oh}:${om}`
  );
}

let _orgIdCache: string | null | undefined;
let _orgIdPromise: Promise<string | null> | null = null;

/** Retorna o organization_id da sessão atual (cache em memória). */
export async function getCurrentOrgId(): Promise<string | null> {
  if (_orgIdCache !== undefined) return _orgIdCache;
  if (_orgIdPromise) return _orgIdPromise;
  _orgIdPromise = (async () => {
    try {
      const { data, error } = await sb.rpc("current_org_id");
      if (error) return (_orgIdCache = null);
      const id = (data ?? null) as string | null;
      _orgIdCache = id;
      return id;
    } catch {
      _orgIdCache = null;
      return null;
    } finally {
      _orgIdPromise = null;
    }
  })();
  return _orgIdPromise;
}

/** Reseta o cache (ex.: ao trocar de organização). */
export function resetOrgIdCache() {
  _orgIdCache = undefined;
  _orgIdPromise = null;
}