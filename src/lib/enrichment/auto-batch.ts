import { useCallback, useEffect, useRef, useState } from "react";
import { runEnrichment } from "./api";

export const ENRICH_BATCH_SIZE = 20;
export const ENRICH_INTERVAL_SEC = 60;

export interface AutoEnrichOptions {
  /** Retorna os CNPJs ainda pendentes de enriquecimento (já filtrados pela tela). */
  getPending: () => string[];
  /** Chamado ao final de cada rodada para atualizar as queries da tela. */
  onBatchDone?: () => void;
  batchSize?: number;
  intervalSec?: number;
}

/**
 * Motor de enriquecimento em lotes: processa N CNPJs e repete a cada X segundos
 * até não haver mais pendências. Usado em /mapa e /prospeccao.
 */
export function useAutoEnrich(opts: AutoEnrichOptions) {
  const batchSize = opts.batchSize ?? ENRICH_BATCH_SIZE;
  const intervalSec = opts.intervalSec ?? ENRICH_INTERVAL_SEC;

  const [auto, setAuto] = useState(false);
  const [running, setRunning] = useState(false);
  const [nextIn, setNextIn] = useState(0);
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const autoRef = useRef(false);
  const busyRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const addLog = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString("pt-BR")} · ${line}`, ...prev].slice(0, 40));
  }, []);

  const runBatch = useCallback(async () => {
    if (busyRef.current) return 0;
    busyRef.current = true;
    setRunning(true);
    try {
      const pending = optsRef.current.getPending();
      if (!pending.length) {
        addLog("Nada pendente — enriquecimento concluído.");
        autoRef.current = false;
        setAuto(false);
        return 0;
      }
      const lote = pending.slice(0, batchSize);
      addLog(`Rodada iniciada: ${lote.length} CNPJ(s) · ${pending.length} pendente(s).`);
      let ok = 0;
      for (const cnpj of lote) {
        try {
          await runEnrichment(cnpj);
          ok += 1;
          setDone((d) => d + 1);
        } catch (e) {
          addLog(`${cnpj}: falha — ${(e as Error).message}`);
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
      addLog(`Rodada concluída: ${ok}/${lote.length} enriquecido(s).`);
      optsRef.current.onBatchDone?.();
      return ok;
    } finally {
      busyRef.current = false;
      setRunning(false);
    }
  }, [addLog, batchSize]);

  useEffect(() => {
    autoRef.current = auto;
    if (!auto) {
      setNextIn(0);
      return;
    }
    void runBatch();
    setNextIn(intervalSec);
    const tick = window.setInterval(() => {
      setNextIn((n) => {
        if (n <= 1) {
          if (autoRef.current) void runBatch();
          return intervalSec;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [auto, intervalSec, runBatch]);

  return {
    auto,
    toggle: () => setAuto((v) => !v),
    stop: () => setAuto(false),
    running,
    nextIn,
    done,
    log,
    runBatch,
    batchSize,
    intervalSec,
  };
}
