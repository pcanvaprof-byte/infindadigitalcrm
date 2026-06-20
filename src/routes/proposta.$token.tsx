import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { formatBRL, COBRANCA_LABEL } from "@/lib/catalog/types";
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

  const empresa = data.cliente?.company || data.lead?.company || "Cliente";
  const contato = data.cliente?.contact_name || data.lead?.owner || "";
  const segmento = data.cliente?.segment || data.lead?.segment || "";
  const conteudo = data.versao?.conteudo_json ?? {};
  const total12 = data.valor_implantacao + data.valor_mensal * 12;

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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Capa */}
      <header className="border-b border-border bg-gradient-to-br from-primary/10 via-card to-background px-6 py-12 sm:px-12 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Logo />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Proposta Comercial · {data.numero}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            {data.titulo}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Preparada para <span className="font-semibold text-foreground">{empresa}</span>
            {contato && <> · {contato}</>}
          </p>
          {data.valid_until && (
            <p className="mt-6 inline-block rounded-full bg-card px-4 py-2 text-xs text-muted-foreground">
              Válida até {new Date(data.valid_until).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-4xl space-y-10 px-6 sm:px-12">
        {/* Sobre */}
        <Section title="Sobre a empresa">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {empresa}{segmento && <> · {segmento}</>}{data.cliente?.city && <> · {data.cliente.city}/{data.cliente.state}</>}
          </p>
        </Section>

        {/* Diagnóstico */}
        {conteudo.diagnostico && (
          <Section title="Diagnóstico">
            <Prose text={conteudo.diagnostico} />
          </Section>
        )}

        {conteudo.problemas && conteudo.problemas.length > 0 && (
          <Section title="Problemas identificados">
            <ul className="space-y-2 text-sm">
              {conteudo.problemas.map((p, i) => (
                <li key={i} className="flex gap-2"><span className="text-rose-400">•</span><span>{p}</span></li>
              ))}
            </ul>
          </Section>
        )}

        {/* Solução */}
        {conteudo.solucao && (
          <Section title="Solução proposta">
            <Prose text={conteudo.solucao} />
          </Section>
        )}

        {/* Escopo / Itens */}
        <Section title="Escopo dos serviços">
          <div className="surface-card overflow-hidden">
            {data.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem itens vinculados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-card/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-left">Cobrança</th>
                    <th className="px-4 py-2 text-right">Qtd</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id} className="border-t border-border/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{it.nome}</p>
                        {it.descricao && <p className="text-[12px] text-muted-foreground">{it.descricao}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs">{COBRANCA_LABEL[it.cobranca as keyof typeof COBRANCA_LABEL]}</td>
                      <td className="px-4 py-3 text-right">{it.quantidade}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatBRL(it.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Section>

        {/* Investimento */}
        <Section title="Investimento">
          <div className="grid gap-3 sm:grid-cols-3">
            <Box label="Implantação (única)" value={formatBRL(data.valor_implantacao)} />
            <Box label="Mensalidade" value={`${formatBRL(data.valor_mensal)}/mês`} />
            <Box label="Total 12 meses" value={formatBRL(total12)} highlight />
          </div>
        </Section>

        {/* Cronograma */}
        {conteudo.cronograma && (
          <Section title="Cronograma">
            <Prose text={conteudo.cronograma} />
          </Section>
        )}

        {/* Aprovação */}
        <Section title="Aprovação">
          {canDecide ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Pronto para começar? Aprove a proposta agora ou solicite ajustes — registramos sua decisão automaticamente.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="btn-gradient" size="lg" onClick={() => setDecisionOpen("aprovada")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                </Button>
                <Button variant="outline" size="lg" onClick={() => setDecisionOpen("ajustes")}>
                  <Edit3 className="mr-2 h-4 w-4" /> Solicitar ajustes
                </Button>
                <Button variant="outline" size="lg" onClick={() => setDecisionOpen("rejeitada")}>
                  <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                </Button>
              </div>
            </>
          ) : (
            <div className="surface-card p-6 text-sm text-muted-foreground">
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
        </Section>
      </main>

      <DecisionDialog
        open={decisionOpen}
        onClose={() => setDecisionOpen(null)}
        onSubmit={async (vals) => {
          try {
            const result = await submitProposalDecision({
              token,
              decisao: decisionOpen!,
              ...vals,
            });
            toast.success("Decisão registrada");
            setDone({ status: result.status, briefingToken: result.briefing_token });
            setDecisionOpen(null);
          } catch (e) {
            // Backend pode rejeitar (expirada / já finalizada). Repassa msg.
            toast.error((e as Error).message || "Não foi possível registrar a decisão.");
            throw e;
          }
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-primary">{title}</h2>
      {children}
    </section>
  );
}
function Prose({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{text}</p>;
}
function Box({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30" : "surface-card"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
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