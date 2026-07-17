import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useBusinessProfile,
  useAnalyzeBusiness,
  useRegenerateMessage,
  useConfirmBusiness,
} from "@/hooks/useBusinessProfile";

export const Route = createFileRoute("/meu-negocio")({
  head: () => ({ meta: [{ title: "Meu Negócio — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <MeuNegocioPage />
    </RequireAuth>
  ),
});

function MeuNegocioPage() {
  const { data: profile, isLoading } = useBusinessProfile();
  const analyze = useAnalyzeBusiness();
  const regenerate = useRegenerateMessage();
  const confirm = useConfirmBusiness();

  const [form, setForm] = useState({
    description: "",
    product: "",
    ideal_customer: "",
    region: "",
    differentials: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        description: profile.description ?? "",
        product: profile.product ?? "",
        ideal_customer: profile.ideal_customer ?? "",
        region: profile.region ?? "",
        differentials: profile.differentials ?? "",
      });
      setMessage(profile.initial_message ?? "");
    }
  }, [profile]);

  const hasAnalysis = !!profile?.analyzed_at;
  const isCompleted = profile?.onboarding_status === "completed";

  const onAnalyze = async () => {
    if (!form.description.trim() && !form.product.trim()) {
      toast.error("Descreva sua empresa ou o produto principal antes de analisar.");
      return;
    }
    try {
      const res = await analyze.mutateAsync(form);
      setMessage(res.ai.initial_message);
      toast.success("Análise concluída pela IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise");
    }
  };

  const onRegenerate = async () => {
    try {
      const res = await regenerate.mutateAsync();
      setMessage(res.initial_message);
      toast.success("Nova mensagem gerada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao regenerar");
    }
  };

  const onConfirm = async () => {
    if (message.trim().length < 10) {
      toast.error("Escreva uma mensagem inicial válida (mín. 10 caracteres).");
      return;
    }
    try {
      await confirm.mutateAsync(message.trim());
      toast.success("Perfil confirmado com sucesso!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao confirmar");
    }
  };

  return (
    <AppShell
      title="Meu Negócio"
      subtitle="Configure sua empresa para personalizar toda a prospecção com IA"
      actions={
        <div className="flex items-center gap-2">
          {isCompleted && (
            <Badge className="gap-1 bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Configurado
            </Badge>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">

        <Card className="space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold">1. Conte sobre seu negócio</h2>
            <p className="text-sm text-muted-foreground">
              Quanto mais detalhes você fornecer, melhor a IA vai personalizar tudo.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="description">Descreva sua empresa</Label>
                <Textarea
                  id="description" rows={3}
                  placeholder="Ex.: Somos uma agência de marketing digital focada em pequenos negócios..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product">Produto / Serviço principal</Label>
                  <Input id="product"
                    placeholder="Ex.: Gestão de tráfego pago"
                    value={form.product}
                    onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ideal">Cliente ideal</Label>
                  <Input id="ideal"
                    placeholder="Ex.: Clínicas médicas e estéticas"
                    value={form.ideal_customer}
                    onChange={(e) => setForm((f) => ({ ...f, ideal_customer: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="region">Região de atuação</Label>
                  <Input id="region"
                    placeholder="Ex.: São Paulo capital / Nacional"
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="diff">Diferenciais</Label>
                  <Input id="diff"
                    placeholder="Ex.: Atendimento 24h, ROI garantido"
                    value={form.differentials}
                    onChange={(e) => setForm((f) => ({ ...f, differentials: e.target.value }))} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onAnalyze} disabled={analyze.isPending}>
                  {analyze.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando…</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> {hasAnalysis ? "Reanalisar com IA" : "Analisar com IA"}</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {hasAnalysis && (
          <Card className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">2. Como a IA entendeu seu negócio</h2>
              <p className="text-sm text-muted-foreground">Revise e valide os pontos identificados.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <InfoRow label="Nicho" value={profile?.niche} />
              <InfoRow label="Público-alvo" value={profile?.audience} />
              <InfoRow label="Tom de voz" value={profile?.tone} />
              <InfoRow label="Linguagem" value={profile?.language} />
              <InfoRow label="Foco comercial" value={profile?.focus} full />
              <InfoRow label="Abordagem sugerida" value={profile?.approach} full />
              <ChipsRow label="Dores identificadas" values={profile?.pains} />
              <ChipsRow label="Benefícios" values={profile?.benefits} />
              <ChipsRow label="Gatilhos" values={profile?.triggers} full />
            </div>
          </Card>
        )}

        {hasAnalysis && (
          <Card className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">3. Primeira mensagem de prospecção</h2>
                <p className="text-sm text-muted-foreground">
                  Edite livremente. Essa mensagem servirá de base para suas cadências.
                </p>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={onRegenerate} disabled={regenerate.isPending}
              >
                {regenerate.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</>
                  : <><RefreshCw className="mr-2 h-4 w-4" /> Gerar outra</>}
              </Button>
            </div>
            <Textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Sua mensagem inicial…"
            />
            <div className="flex justify-end">
              <Button onClick={onConfirm} disabled={confirm.isPending}>
                {confirm.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</>
                  : <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar configuração</>}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground">{value?.trim() || "—"}</div>
    </div>
  );
}

function ChipsRow({ label, values, full }: { label: string; values?: string[] | null; full?: boolean }) {
  const arr = Array.isArray(values) ? values.filter(Boolean) : [];
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {arr.length ? (
        <div className="flex flex-wrap gap-1.5">
          {arr.map((v, i) => (<Badge key={i} variant="secondary">{v}</Badge>))}
        </div>
      ) : (<span className="text-sm text-muted-foreground">—</span>)}
    </div>
  );
}