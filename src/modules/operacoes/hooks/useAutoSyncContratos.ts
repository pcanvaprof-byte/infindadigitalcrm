import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { importClientesFromContratos } from "../api";

const STORAGE_KEY = "operacoes:lastContratosSync";
const INTERVAL_MS = 15 * 60 * 1000; // 15 min

function readLast(): number {
  if (typeof window === "undefined") return 0;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v ? Number(v) || 0 : 0;
}

function writeLast(ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(ts));
}

export function useAutoSyncContratos() {
  const qc = useQueryClient();
  const [lastSync, setLastSync] = useState<number>(() => readLast());
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const run = useCallback(
    async (force = false) => {
      if (running.current) return;
      const last = readLast();
      if (!force && Date.now() - last < INTERVAL_MS) return;
      running.current = true;
      setSyncing(true);
      try {
        const res = await importClientesFromContratos();
        const now = Date.now();
        writeLast(now);
        setLastSync(now);
        if (res.importados > 0) {
          qc.invalidateQueries({ queryKey: ["op-clientes"] });
          qc.invalidateQueries({ queryKey: ["op-dashboard"] });
        }
        console.info("[operacoes] auto-sync contratos", res);
      } catch (e) {
        console.error("[operacoes] auto-sync contratos falhou", e);
      } finally {
        running.current = false;
        setSyncing(false);
      }
    },
    [qc],
  );

  useEffect(() => {
    void run(false);
    const id = window.setInterval(() => void run(false), INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void run(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [run]);

  return { lastSync, syncing, runNow: () => run(true) };
}