import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  getProposalByToken, registerProposalView, submitProposalDecision,
} from "@/lib/propostas/api";
import type { PublicProposal } from "@/lib/propostas/types";
import { resolveFromPublic } from "@/lib/proposta/viewModel";
import { ProposalRenderer } from "@/components/proposta/renderer/ProposalRenderer";
import { CheckCircle2, Edit3, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/proposta/$token")({
  head: () => ({ meta: [{ title: "Proposta Comercial — INFINDA" }] }),
  component: PublicProposalPage,
});

function PublicProposalPage() {
  const { token } = useParams({ from: "/proposta/$token" });
  const [data, setData] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [decisionOpen, setDecisionOpen] = useState<null | "aprovada" | "ajustes" | "rejeitada">(null);
  const [done, setDone] = useState<null | { status: string; briefingToken?: string }>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await getProposalByToken(token);
        if (p) {
          setData(p);
          void registerProposalView(token).catch(() => undefined);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <FullScreen><Loader2 className="h-6 w-6 animate-spin text-primary" /></FullScreen>;
  if (!data) return <FullScreen><p className="text-sm text-muted-foreground">Proposta não encontrada ou link inválido.</p></FullScreen>;

  // Guard atômico (defesa em profundidade — backend é a fonte da verdade)
  const isExpired =
    !!data.valid_until && new Date(data.valid_until).getTime() < Date.now();
  const isFinalized = ["aprovada", "rejeitada", "expirada", "convertida"].includes(
    String(data.status)
  );
  const canDecide = !isExpired && !isFinalized;

  if (done) {
    return (
      <FullScreen>
        <div className="surface-card max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-3 text-xl font-bold">Decisão registrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua resposta foi registrada com sucesso. Nossa equipe entrará em contato em breve.
          </p>
          {done.briefingToken && (
            <a href={`/briefing/${done.briefingToken}`} className="mt-4 inline-block text-sm text-primary underline">
              Continuar preenchendo o briefing →
            </a>
          )}
        </div>
      </FullScreen>
    );
  }

  return <PublicProposalView data={data} canDecide={canDecide} isExpired={isExpired} setDecisionOpen={setDecisionOpen} decisionOpen={decisionOpen} onSubmit={async (vals) => {
    try {
      const result = await submitProposalDecision({ token, decisao: decisionOpen!, ...vals });
      toast.success("Decisão registrada");
      setDone({ status: result.status, briefingToken: result.briefing_token });
      setDecisionOpen(null);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível registrar a decisão.");
      throw e;
    }
  }} />;
}

function PublicProposalView({
  data, canDecide, isExpired, decisionOpen, setDecisionOpen, onSubmit,
}: {
  data: PublicProposal;
  canDecide: boolean;
  isExpired: boolean;
  decisionOpen: null | "aprovada" | "ajustes" | "rejeitada";
  setDecisionOpen: (v: null | "aprovada" | "ajustes" | "rejeitada") => void;
  onSubmit: (vals: { nome: string; cargo?: string; documento?: string; mensagem?: string }) => Promise<void>;
}) {
  const vm = useMemo(() => resolveFromPublic(data, { mode: "web" }), [data]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="border-b border-border bg-card/30 px-6 py-4 sm:px-10">
        <div className="mx-auto max-w-5xl"><Logo /></div>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <ProposalRenderer vm={vm} />

        <section className="mt-16">
          <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">Aprovação</div>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Pronto para começar?</h2>
          {canDecide ? (
            <>
              <p className="mt-3 mb-6 text-sm text-muted-foreground max-w-2xl">
                Aprove a proposta agora ou solicite ajustes — registramos sua decisão automaticamente.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Button className="btn-gradient h-auto py-5 justify-start text-left" onClick={() => setDecisionOpen("aprovada")}>
                  <CheckCircle2 className="mr-3 h-5 w-5 shrink-0" />
                  <span className="flex flex-col items-start">
                    <span className="text-base font-bold">Aprovar proposta</span>
                    <span className="text-xs opacity-80">Quero começar agora</span>
                  </span>
                </Button>
                <Button variant="outline" className="h-auto py-5 justify-start text-left" onClick={() => setDecisionOpen("ajustes")}>
                  <Edit3 className="mr-3 h-5 w-5 shrink-0" />
                  <span className="flex flex-col items-start">
                    <span className="text-base font-bold">Solicitar ajustes</span>
                    <span className="text-xs opacity-70">Quero personalizar</span>
                  </span>
                </Button>
                <Button variant="outline" className="h-auto py-5 justify-start text-left" onClick={() => setDecisionOpen("rejeitada")}>
                  <XCircle className="mr-3 h-5 w-5 shrink-0" />
                  <span className="flex flex-col items-start">
                    <span className="text-base font-bold">Rejeitar proposta</span>
                    <span className="text-xs opacity-70">Não é o momento</span>
                  </span>
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-4 surface-card p-6 text-sm text-muted-foreground">
              {isExpired ? (
                <>
                  <p className="font-semibold text-foreground">
                    Esta proposta expirou em {new Date(data.valid_until!).toLocaleDateString("pt-BR")}.
                  </p>
                  <p className="mt-2">
                    Entre em contato com nosso time comercial para receber uma nova versão atualizada.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">
                    Esta proposta já foi finalizada (status: {data.status}).
                  </p>
                  <p className="mt-2">
                    Se precisar revisitar a decisão, fale com o time comercial.
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      </main>

      <DecisionDialog
        open={decisionOpen}
        onClose={() => setDecisionOpen(null)}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-background p-6">{children}</div>;
}

function DecisionDialog({
  open, onClose, onSubmit,
}: {
  open: null | "aprovada" | "ajustes" | "rejeitada";
  onClose: () => void;
  onSubmit: (vals: { nome: string; cargo?: string; documento?: string; mensagem?: string }) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [doc, setDoc] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const titulo = open === "aprovada" ? "Aprovar proposta" : open === "ajustes" ? "Solicitar ajustes" : "Rejeitar proposta";

  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Seu nome *</p>
            <Input className="mt-1 h-9" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Cargo</p>
            <Input className="mt-1 h-9" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">CPF / CNPJ</p>
            <Input className="mt-1 h-9" value={doc} onChange={(e) => setDoc(e.target.value)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Mensagem</p>
            <Textarea className="mt-1 min-h-[80px]" value={msg} onChange={(e) => setMsg(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="btn-gradient" disabled={!nome.trim() || saving}
            onClick={async () => {
              setSaving(true);
              try { await onSubmit({ nome, cargo, documento: doc, mensagem: msg }); }
              catch (e) { toast.error((e as Error).message); }
              finally { setSaving(false); }
            }}>
            {saving ? "Enviando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}