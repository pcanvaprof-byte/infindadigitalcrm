import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { gerarInsightBI } from "@/lib/bi/insights.functions";
import { listAIInsights, type AIInsight, type BIArea } from "@/lib/bi/api";

export function AIInsightsPanel({ area }: { area: BIArea }) {
  const [items, setItems] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gerar = useServerFn(gerarInsightBI);

  const reload = async () => {
    setLoading(true);
    try { setItems(await listAIInsights(area)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [area]);

  const generate = async () => {
    setBusy(true); setErr(null);
    try { await gerar({ data: { area } }); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Insights de IA
        </CardTitle>
        <Button size="sm" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="ml-2">{busy ? "Analisando..." : "Gerar análise"}</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {err && <p className="text-sm text-destructive">{err}</p>}
        {loading && items.length === 0 && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma análise ainda. Clique em <strong>Gerar análise</strong>.
          </p>
        )}
        {items.map((it) => (
          <div key={it.id} className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground mb-1">
              {new Date(it.created_at).toLocaleString("pt-BR")}
            </p>
            <p className="text-sm whitespace-pre-wrap mb-2">{it.summary}</p>
            {it.recommendations.length > 0 && (
              <ul className="text-sm list-disc pl-5 space-y-1">
                {it.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}