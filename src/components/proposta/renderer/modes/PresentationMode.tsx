/**
 * PresentationMode — divide o ProposalViewModel em slides 1920x1080,
 * navegáveis por teclado. Cada slide é UMA seção do renderer (puro).
 * Sem fallback, sem cálculo.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProposalViewModel } from "@/lib/proposta/viewModel";
import { HeroSection } from "../sections/Hero";
import { DiagnosticoSection } from "../sections/Diagnostico";
import { SolucaoSection } from "../sections/Solucao";
import { BeneficiosSection } from "../sections/Beneficios";
import { ROISection } from "../sections/ROI";
import { TimelineSection } from "../sections/Timeline";
import { CasesSection } from "../sections/Cases";
import { PorqueInfindaSection } from "../sections/PorqueInfinda";
import { PacotesSection } from "../sections/Pacotes";
import { InvestimentoSection } from "../sections/Investimento";
import { ProximosPassosSection } from "../sections/ProximosPassos";

interface Props {
  vm: ProposalViewModel;
  onExit?: () => void;
}

export function PresentationMode({ vm, onExit }: Props) {
  const slides = buildSlides(vm);
  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function calc() {
      const sx = window.innerWidth / 1920;
      const sy = window.innerHeight / 1080;
      setScale(Math.min(sx, sy));
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") setIdx((i) => Math.min(i + 1, slides.length - 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setIdx((i) => Math.max(i - 1, 0));
      else if (e.key === "Escape") onExit?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onExit]);

  const slide = slides[idx];

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: 1920,
          height: 1080,
          marginLeft: -960,
          marginTop: -540,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <div className="w-full h-full bg-background text-foreground px-32 py-24 overflow-hidden">
          <div className="h-full flex flex-col justify-center">
            <div className="space-y-12">{slide.node}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-full bg-card/90 backdrop-blur ring-1 ring-border px-4 py-2 text-sm">
        <button onClick={() => setIdx((i) => Math.max(i - 1, 0))} className="grid place-items-center size-8 rounded-full hover:bg-muted" aria-label="Anterior">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-muted-foreground tabular-nums">{idx + 1} / {slides.length}</span>
        <button onClick={() => setIdx((i) => Math.min(i + 1, slides.length - 1))} className="grid place-items-center size-8 rounded-full hover:bg-muted" aria-label="Próximo">
          <ChevronRight className="size-4" />
        </button>
        {onExit && (
          <button onClick={onExit} className="ml-2 grid place-items-center size-8 rounded-full hover:bg-destructive/20 text-destructive" aria-label="Sair">
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function buildSlides(vm: ProposalViewModel): { id: string; node: React.ReactNode }[] {
  const list: { id: string; node: React.ReactNode }[] = [];
  list.push({ id: "hero", node: <HeroSection header={vm.header} /> });
  list.push({ id: "diag", node: <DiagnosticoSection diagnostico={vm.diagnostico} header={vm.header} /> });
  list.push({ id: "sol", node: <SolucaoSection solucao={vm.solucao} /> });
  if (vm.beneficios.length > 0) list.push({ id: "ben", node: <BeneficiosSection beneficios={vm.beneficios} /> });
  list.push({ id: "roi", node: <ROISection roi={vm.roi} /> });
  if (vm.timeline.length > 0) list.push({ id: "tim", node: <TimelineSection timeline={vm.timeline} /> });
  if (vm.cases.length > 0) list.push({ id: "cas", node: <CasesSection cases={vm.cases} /> });
  if (vm.porqueInfinda.length > 0) list.push({ id: "pq", node: <PorqueInfindaSection pontos={vm.porqueInfinda} /> });
  if (vm.pacotes.length > 0) list.push({ id: "pkg", node: <PacotesSection pacotes={vm.pacotes} /> });
  list.push({ id: "inv", node: <InvestimentoSection investimento={vm.investimento} /> });
  if (vm.proximosPassos.length > 0) list.push({ id: "next", node: <ProximosPassosSection passos={vm.proximosPassos} /> });
  return list;
}