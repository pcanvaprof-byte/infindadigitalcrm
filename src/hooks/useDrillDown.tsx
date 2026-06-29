import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DrillDownSheet } from "@/components/bi/DrillDownSheet";
import type { DrillKind } from "@/lib/bi/drilldown";
import type { ResolvedPeriod } from "@/lib/bi/period";

export interface DrillFrame {
  id: string;
  kind: DrillKind;
  title: string;
  subtitle?: string;
  params?: Record<string, unknown>;
  /** Trilha visível (BI > Comercial > Contratos). */
  crumb?: string;
}

interface DrillCtx {
  stack: DrillFrame[];
  open: (frame: DrillFrame) => void;
  push: (frame: DrillFrame) => void;
  back: () => void;
  close: () => void;
  period: ResolvedPeriod;
}

const Ctx = createContext<DrillCtx | null>(null);

export function DrillDownProvider({
  period,
  areaLabel,
  children,
}: {
  period: ResolvedPeriod;
  areaLabel: string;
  children: ReactNode;
}) {
  const [stack, setStack] = useState<DrillFrame[]>([]);

  const open = useCallback((frame: DrillFrame) => {
    setStack([{ ...frame, crumb: frame.crumb ?? frame.title }]);
  }, []);
  const push = useCallback((frame: DrillFrame) => {
    setStack((s) => [...s, { ...frame, crumb: frame.crumb ?? frame.title }]);
  }, []);
  const back = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);
  const close = useCallback(() => setStack([]), []);

  const value = useMemo<DrillCtx>(
    () => ({ stack, open, push, back, close, period }),
    [stack, open, push, back, close, period],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <DrillDownSheet
        open={stack.length > 0}
        stack={stack}
        period={period}
        areaLabel={areaLabel}
        onClose={close}
        onBack={back}
        onPush={push}
      />
    </Ctx.Provider>
  );
}

export function useDrillDown() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Sem provider: noop seguro (componentes podem existir fora do BI).
    return {
      stack: [] as DrillFrame[],
      open: () => {},
      push: () => {},
      back: () => {},
      close: () => {},
      period: null as unknown as ResolvedPeriod,
    } satisfies DrillCtx;
  }
  return ctx;
}
