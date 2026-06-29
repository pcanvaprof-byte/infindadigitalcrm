export interface FunilStage {
  stage: string;
  clientes: number;
}

/**
 * Funil Executivo — Bento Linear Mono.
 * Cada etapa = card. Densidade alta, gargalo marcado com ring indigo sutil.
 * Paleta travada: bg #08090A, surface #1C1D1F, border #2E2E33, text #E1E1E6, accent #5E6AD2.
 */
export function FunilExecutivo({ stages }: { stages: FunilStage[] }) {
  if (!stages?.length) return null;

  // Maior queda relativa = gargalo
  let worstIdx = -1;
  let worstDrop = 0;
  stages.forEach((s, i) => {
    if (i === 0) return;
    const prev = stages[i - 1].clientes;
    const drop = prev > 0 ? 1 - s.clientes / prev : 0;
    if (drop > worstDrop) {
      worstDrop = drop;
      worstIdx = i;
    }
  });

  const first = stages[0]?.clientes ?? 0;
  // Span 12-col por etapa para layout proporcional ao número de etapas
  // 5 etapas → hero (col-span-8) + 4 (col-span-4) + 4 + 4 + 4 (wrap)
  // fallback genérico: dividir igualmente em 12
  const SPAN_CLASS: Record<number, string> = {
    3: "md:col-span-3",
    4: "md:col-span-4",
    6: "md:col-span-6",
    8: "md:col-span-8",
    12: "md:col-span-12",
  };
  const spans = (() => {
    const n = stages.length;
    if (n === 5) return [8, 4, 4, 4, 4];
    const base = Math.max(3, Math.floor(12 / n));
    return stages.map(() => base);
  })();

  return (
    <div className="rounded-2xl border border-[#2E2E33] bg-[#08090A]/40 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold tracking-wide text-[#E1E1E6]" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>
          Funil executivo
        </h3>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#E1E1E6]/40">
          {stages.length} etapas
        </span>
      </div>

      <div className="grid grid-cols-12 gap-3 sm:gap-4 auto-rows-[150px]">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].clientes : null;
          const convPct = prev && prev > 0 ? Math.round((s.clientes / prev) * 100) : null;
          const totalPct = first > 0 ? Math.round((s.clientes / first) * 100) : 0;
          const isWorst = i === worstIdx;
          const isHero = i === 0;

          return (
            <div
              key={s.stage}
              className={[
                "group relative col-span-12 flex flex-col justify-between rounded-2xl border bg-[#1C1D1F] p-5 transition-all duration-200",
                SPAN_CLASS[spans[i]] ?? "md:col-span-4",
                isWorst
                  ? "border-[#5E6AD2]/45 shadow-[0_0_24px_-8px_rgba(94,106,210,0.35)]"
                  : "border-[#2E2E33] hover:border-[#2E2E33]/80 hover:-translate-y-px",
              ].join(" ")}
              style={{ animation: `fadeUp 320ms ease-out both`, animationDelay: `${i * 60}ms` }}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <p
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E1E1E6]/55"
                  style={{ fontFamily: "'DM Sans', ui-sans-serif" }}
                >
                  {s.stage}
                </p>
                {isWorst ? (
                  <span
                    className="rounded-full border border-[#5E6AD2]/35 bg-[#5E6AD2]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#5E6AD2]"
                    style={{ fontFamily: "'DM Sans', ui-sans-serif" }}
                  >
                    Gargalo
                  </span>
                ) : (
                  <span
                    className={[
                      "h-1.5 w-1.5 rounded-full",
                      isHero ? "bg-[#5E6AD2] shadow-[0_0_10px_#5E6AD2]" : "bg-[#E1E1E6]/20",
                    ].join(" ")}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className={[
                      "font-bold leading-none tracking-tight tabular-nums text-[#E1E1E6]",
                      isHero ? "text-5xl" : "text-4xl",
                    ].join(" ")}
                    style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}
                  >
                    {s.clientes.toLocaleString("pt-BR")}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-[#2E2E33]">
                      <div
                        className={[
                          "h-full transition-all duration-700",
                          isWorst ? "bg-[#5E6AD2]" : "bg-[#E1E1E6]/40",
                        ].join(" ")}
                        style={{ width: `${Math.max(4, totalPct)}%` }}
                      />
                    </div>
                    <span
                      className="text-[10px] uppercase tracking-wider text-[#E1E1E6]/45"
                      style={{ fontFamily: "'DM Sans', ui-sans-serif" }}
                    >
                      {totalPct}% do topo
                    </span>
                  </div>
                </div>

                {convPct !== null && (
                  <div className="text-right">
                    <div
                      className={[
                        "text-xs font-semibold tabular-nums",
                        isWorst ? "text-[#5E6AD2]" : "text-[#E1E1E6]/70",
                      ].join(" ")}
                      style={{ fontFamily: "'DM Sans', ui-sans-serif" }}
                    >
                      ↓ {convPct}%
                    </div>
                    <div
                      className="text-[9px] uppercase tracking-[0.18em] text-[#E1E1E6]/35"
                      style={{ fontFamily: "'DM Sans', ui-sans-serif" }}
                    >
                      conv. etapa
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 px-1">
        <span
          className="text-[10px] uppercase tracking-[0.22em] text-[#E1E1E6]/30"
          style={{ fontFamily: "'DM Sans', ui-sans-serif" }}
        >
          Performance · funil comercial
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2E2E33] to-transparent" />
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}