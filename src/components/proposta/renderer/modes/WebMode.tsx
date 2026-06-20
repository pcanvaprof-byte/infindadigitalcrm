/**
 * WebMode — público + portal. Sticky CTA + container responsivo.
 * Zero lógica de negócio. Modais de decisão são providos por fora.
 */
import { useState } from "react";
import type { ProposalViewModel, ProposalViewModelHandlers } from "@/lib/proposta/viewModel";
import { ProposalRenderer } from "../ProposalRenderer";
import { StickyApprovalBar } from "../StickyApprovalBar";
import { ApprovalDialog } from "../dialogs/ApprovalDialog";
import { AdjustmentDialog } from "../dialogs/AdjustmentDialog";
import { RejectDialog } from "../dialogs/RejectDialog";

interface Props {
  vm: ProposalViewModel;
  handlers: ProposalViewModelHandlers;
}

export function WebMode({ vm, handlers }: Props) {
  const [openApprove, setOpenApprove] = useState(false);
  const [openAdjust, setOpenAdjust] = useState(false);
  const [openReject, setOpenReject] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-10 md:py-16 pb-32 md:pb-32">
        <ProposalRenderer vm={vm} handlers={handlers} />
      </main>
      <StickyApprovalBar
        vm={vm}
        handlers={handlers}
        onApproveClick={() => setOpenApprove(true)}
        onAdjustClick={() => setOpenAdjust(true)}
        onRejectClick={() => setOpenReject(true)}
      />
      <ApprovalDialog open={openApprove} onOpenChange={setOpenApprove} onSubmit={handlers.onApproveAll} />
      <AdjustmentDialog open={openAdjust} onOpenChange={setOpenAdjust} onSubmit={handlers.onRequestAdjustment} />
      <RejectDialog open={openReject} onOpenChange={setOpenReject} onSubmit={handlers.onReject} />
    </div>
  );
}