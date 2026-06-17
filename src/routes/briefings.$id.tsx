import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import { getBriefingById } from "@/lib/briefings/api";
import { getQuestions } from "@/lib/briefings/questions";
import { downloadBriefingPdf } from "@/lib/briefings/pdf";
import { gerarResumoBriefing } from "@/lib/briefings/ai.functions";
import { SERVICO_LABEL, STATUS_LABEL, type Briefing } from "@/lib/briefings/types";

export const Route = createFileRoute("/briefings/$id")({
  head: () => ({ meta: [{ title: "Briefing — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <Detail />
    </RequireAuth>
  ),
});

function Detail() {
  const { id } = useParams({ from: "/briefings/$id" });
  const [b, setB] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    try { setB(await getBriefingById(id)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id]);

  async function generateAI() {
    if (!b) return;
    setGenerating(true);
    try {
      const { resumo } = await gerarResumoBriefing({ data: { token: b.token_publico } });
      setB({ ...b, resumo_ia: resumo });
      toast.success("Resumo IA gerado");
    } catch (e) {
      toast.error("Falha ao gerar resumo IA", { description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <AppShell title="Briefing"><p className="text-muted-foreground">Carregando…</p></AppShell>;
  if (!b) return <AppShell title="Briefing"><p className="text-muted-foreground">Não encontrado.</p></AppShell>;

  const sections = getQuestions(b.servico);

  return (
    <AppShell
      title={b.cliente_nome ?? "Briefing"}
      subtitle={SERVICO_LABEL[b.servico]}
      actions={
        <div className="flex gap-2">
          <Link to="/briefings"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button></Link>
          <Button size="sm" variant="outline" onClick={() => downloadBriefingPdf(b)}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Badge>{STATUS_LABEL[b.status]}</Badge>
            <span className="text-xs text-muted-foreground">
              Criado em {new Date(b.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
          {sections.map((s) => (
            <div key={s.id} className="mb-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</h3>
              <div className="space-y-3">
                {s.questions.map((q) => (
                  <div key={q.id}>
                    <p className="text-xs text-muted-foreground">{q.label}</p>
                    <p className="text-sm">{(b.respostas_json?.[`${s.id}.${q.id}`] as string | undefined) || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="surface-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Cliente</h3>
            <dl className="space-y-1 text-sm">
              <div><dt className="text-muted-foreground">Empresa</dt><dd>{b.empresa ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Telefone</dt><dd>{b.telefone ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">E-mail</dt><dd>{b.email ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Responsável</dt><dd>{b.responsavel ?? "—"}</dd></div>
            </dl>
          </div>
          <div className="surface-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Resumo Executivo (IA)</h3>
              <Button size="sm" variant="ghost" onClick={generateAI} disabled={generating}>
                <Sparkles className="mr-1 h-4 w-4" /> {generating ? "Gerando…" : "Gerar"}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{b.resumo_ia || "Ainda não gerado."}</pre>
          </div>
          <div className="surface-card p-4 space-y-2">
            <Button className="w-full" variant="outline" onClick={() => toast.info("Em breve")}>Enviar para Produção</Button>
            <Button className="w-full" variant="outline" onClick={() => toast.info("Em breve")}>Converter em Projeto</Button>
            <Button className="w-full" variant="outline" onClick={() => toast.info("Em breve")}>Converter em Proposta</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}