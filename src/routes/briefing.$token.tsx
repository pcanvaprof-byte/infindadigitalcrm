import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getBriefingByToken, saveAnswersByToken, type PublicBriefing } from "@/lib/briefings/api";
import { getQuestions, countQuestions } from "@/lib/briefings/questions";
import { gerarResumoBriefing } from "@/lib/briefings/ai.functions";
import { SERVICO_LABEL } from "@/lib/briefings/types";

export const Route = createFileRoute("/briefing/$token")({
  head: () => ({ meta: [{ title: "Briefing — INFINDA Digital" }] }),
  component: PublicBriefingPage,
});

function PublicBriefingPage() {
  const { token } = useParams({ from: "/briefing/$token" });
  const [briefing, setBriefing] = useState<PublicBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const b = await getBriefingByToken(token);
        if (!b) { setNotFound(true); return; }
        setBriefing(b);
        setAnswers((b.respostas_json ?? {}) as Record<string, string>);
        if (b.status === "concluido") setFinished(true);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const sections = useMemo(() => (briefing ? getQuestions(briefing.servico) : []), [briefing]);
  const total = useMemo(() => countQuestions(sections), [sections]);
  const answered = Object.values(answers).filter((v) => (v ?? "").trim() !== "").length;
  const progress = total ? Math.round((answered / total) * 100) : 0;
  const remainingMin = Math.max(1, Math.ceil(((total - answered) * 30) / 60));

  const persist = useCallback(async (status?: "em_preenchimento" | "concluido") => {
    if (!briefing) return;
    setSaving(true);
    try {
      await saveAnswersByToken(token, answers, status);
      setSavedAt(Date.now());
      dirty.current = false;
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }, [answers, briefing, token]);

  // auto-save a cada 10s se sujo
  useEffect(() => {
    const id = setInterval(() => {
      if (dirty.current && !finished) void persist("em_preenchimento");
    }, 10000);
    return () => clearInterval(id);
  }, [persist, finished]);

  function update(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    dirty.current = true;
  }

  async function next() {
    await persist("em_preenchimento");
    setStep((s) => Math.min(s + 1, sections.length - 1));
  }
  async function prev() {
    await persist("em_preenchimento");
    setStep((s) => Math.max(s - 1, 0));
  }
  async function finish() {
    await persist("concluido");
    setFinished(true);
    gerarResumoBriefing({ data: { token } }).catch(() => undefined);
  }

  if (loading) {
    return <CenterScreen><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CenterScreen>;
  }
  if (notFound || !briefing) {
    return <CenterScreen><p className="text-muted-foreground">Briefing não encontrado.</p></CenterScreen>;
  }
  if (finished) {
    return (
      <CenterScreen>
        <div className="max-w-md text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold">Obrigado!</h2>
          <p className="mt-2 text-muted-foreground">
            Obrigado por preencher seu briefing. Nossa equipe analisará as informações e
            entrará em contato em breve com os próximos passos.
          </p>
        </div>
      </CenterScreen>
    );
  }

  const section = sections[step];
  const isLast = step === sections.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="text-xs text-muted-foreground">{SERVICO_LABEL[briefing.servico]}</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress}% concluído</span>
            <span>Tempo restante estimado: ~{remainingMin} min</span>
          </div>
          <Progress value={progress} />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Etapa {step + 1} de {sections.length} · {section.title}</span>
            <span>
              {saving ? "Salvando…" : savedAt ? "✓ Salvo automaticamente" : ""}
            </span>
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{section.title}</h2>
          <div className="space-y-5">
            {section.questions.map((q) => {
              const key = `${section.id}.${q.id}`;
              const value = answers[key] ?? "";
              return (
                <div key={key} className="grid gap-1.5">
                  <Label>{q.label}{q.required && <span className="text-destructive"> *</span>}</Label>
                  {q.type === "textarea" ? (
                    <Textarea value={value} onChange={(e) => update(key, e.target.value)} onBlur={() => persist("em_preenchimento")} />
                  ) : q.type === "select" || q.type === "radio" ? (
                    <Select value={value} onValueChange={(v) => { update(key, v); void persist("em_preenchimento"); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        {(q.options ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={value} placeholder={q.placeholder} onChange={(e) => update(key, e.target.value)} onBlur={() => persist("em_preenchimento")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={prev} disabled={step === 0}>Voltar</Button>
          {isLast ? (
            <Button onClick={finish}>Finalizar briefing</Button>
          ) : (
            <Button onClick={next}>Próxima etapa</Button>
          )}
        </div>
      </main>
    </div>
  );
}

function CenterScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">{children}</div>
  );
}