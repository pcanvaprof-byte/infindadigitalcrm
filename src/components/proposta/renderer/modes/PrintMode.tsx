/**
 * PrintMode — HTML linear, sem JS. Otimizado para window.print() +
 * futuro PDF server-side (puppeteer/playwright lendo a mesma página).
 *
 * Não importa nada interativo. Não usa hooks de estado. Não tem CTA.
 */
import type { ProposalViewModel } from "@/lib/proposta/viewModel";
import { ProposalRenderer } from "../ProposalRenderer";

interface Props { vm: ProposalViewModel }

export function PrintMode({ vm }: Props) {
  return (
    <>
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          body { background: white !important; }
          .print-page { background: white !important; color: #0b0b13 !important; }
          .print-page * { box-shadow: none !important; }
          section { page-break-inside: avoid; }
          h1, h2, h3 { page-break-after: avoid; }
        }
      `}</style>
      <div className="print-page mx-auto max-w-[210mm] px-8 py-10 bg-background text-foreground">
        <ProposalRenderer vm={{ ...vm, capabilities: { ...vm.capabilities, showStickyCTA: false, canApproveProposal: false, canApproveItems: false } }} />
      </div>
    </>
  );
}