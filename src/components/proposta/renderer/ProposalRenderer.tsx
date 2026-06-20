/**
 * ProposalRenderer — orquestrador puro.
 *
 * REGRAS INVIOLÁVEIS:
 * - Não faz I/O.
 * - Não calcula nada.
 * - Não aplica fallback.
 * - Apenas renderiza o que o ViewModel já decidiu.
 * - Callbacks vêm de fora (handlers), nunca recriados aqui.
 */

import type { ProposalViewModel, ProposalViewModelHandlers } from "@/lib/proposta/viewModel";
import { HeroSection } from "./sections/Hero";
import { ValidadeBadge } from "./sections/ValidadeBadge";
import { DiagnosticoSection } from "./sections/Diagnostico";
import { SolucaoSection } from "./sections/Solucao";
import { BeneficiosSection } from "./sections/Beneficios";
import { ROISection } from "./sections/ROI";
import { CrescimentoSection } from "./sections/Crescimento";
import { PorqueInfindaSection } from "./sections/PorqueInfinda";
import { CasesSection } from "./sections/Cases";
import { TimelineSection } from "./sections/Timeline";
import { InvestimentoSection } from "./sections/Investimento";
import { PacotesSection } from "./sections/Pacotes";
import { ItensSection } from "./sections/Itens";
import { ProximosPassosSection } from "./sections/ProximosPassos";
import { AnexosSection } from "./sections/Anexos";

interface Props {
  vm: ProposalViewModel;
  handlers?: ProposalViewModelHandlers;
}

export function ProposalRenderer({ vm, handlers = {} }: Props) {
  return (
    <div className="space-y-16 md:space-y-24">
      <header className="space-y-4">
        <ValidadeBadge header={vm.header} />
        <HeroSection header={vm.header} crescimento={vm.crescimento} roi={vm.roi} />
      </header>

      <DiagnosticoSection diagnostico={vm.diagnostico} header={vm.header} />
      <SolucaoSection solucao={vm.solucao} />
      <BeneficiosSection beneficios={vm.beneficios} />
      <ROISection roi={vm.roi} />
      {vm.crescimento && <CrescimentoSection crescimento={vm.crescimento} />}
      <PorqueInfindaSection pontos={vm.porqueInfinda} />
      <CasesSection cases={vm.cases} />
      <TimelineSection timeline={vm.timeline} />
      <PacotesSection pacotes={vm.pacotes} />
      <ItensSection
        itens={vm.itens}
        canDecide={vm.capabilities.canApproveItems}
        onAccept={handlers.onApproveItem ? (id) => void handlers.onApproveItem?.(id, { nome: "", email: "" }) : undefined}
        onReject={handlers.onRejectItem ? (id) => void handlers.onRejectItem?.(id) : undefined}
      />
      <InvestimentoSection investimento={vm.investimento} crescimento={vm.crescimento} itens={vm.itens} />
      <ProximosPassosSection passos={vm.proximosPassos} />
      <AnexosSection anexos={vm.anexos} />

      {vm.observacoes && (
        <section className="rounded-2xl bg-card/50 ring-1 ring-border p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Observações</h3>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{vm.observacoes}</p>
        </section>
      )}

      <footer className="text-center text-xs text-muted-foreground pt-8 border-t border-border">
        <p>
          Proposta {vm.header.numero}
          {vm.meta.versionNumber && ` · v${vm.meta.versionNumber}`}
          {" · "}Infinda Digital
        </p>
        {vm.meta.source === "fallback" && (
          <p className="mt-1 text-warning/80 italic">Conteúdo gerado em modo de contingência</p>
        )}
      </footer>
    </div>
  );
}