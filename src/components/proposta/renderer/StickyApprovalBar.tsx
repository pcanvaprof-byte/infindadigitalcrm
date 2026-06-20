import { Check, MessageSquare, X } from "lucide-react";
import { brl, type ProposalViewModel, type ProposalViewModelHandlers } from "@/lib/proposta/viewModel";

interface Props {
  vm: ProposalViewModel;
  handlers: ProposalViewModelHandlers;
  onApproveClick: () => void;
  onAdjustClick: () => void;
  onRejectClick: () => void;
}

export function StickyApprovalBar({ vm, handlers: _h, onApproveClick, onAdjustClick, onRejectClick }: Props) {
  if (!vm.capabilities.showStickyCTA) return null;
  const total = vm.investimento.total12m;
  const podeDecidir = vm.capabilities.canApproveProposal;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 print:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Investimento total · 12 meses</div>
          <div className="text-lg sm:text-xl font-bold truncate">{brl(total)}</div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {podeDecidir && (
            <>
              <button
                type="button"
                onClick={onRejectClick}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium ring-1 ring-border text-muted-foreground hover:text-foreground hover:ring-foreground/30 transition"
              >
                <X className="size-4" />
                <span className="hidden sm:inline">Recusar</span>
              </button>
              <button
                type="button"
                onClick={onAdjustClick}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium ring-1 ring-border text-foreground hover:bg-muted transition"
              >
                <MessageSquare className="size-4" />
                <span className="hidden sm:inline">Solicitar ajuste</span>
              </button>
              <button
                type="button"
                onClick={onApproveClick}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-lg shadow-primary/30"
              >
                <Check className="size-4" />
                Aprovar proposta
              </button>
            </>
          )}
          {!podeDecidir && (
            <div className="text-sm text-muted-foreground italic">Esta proposta não está mais ativa para decisão.</div>
          )}
        </div>
      </div>
    </div>
  );
}