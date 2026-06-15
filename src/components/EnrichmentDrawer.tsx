import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, MapPin, Building2, Activity, Flame, CheckCircle2, AlertCircle, Loader2, Circle, Phone, Mail, Footprints, Copy, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { runEnrichment, loadExistingEnrichment, addVisit, listVisits, STEPS, type StepEvent } from "@/lib/enrichment/api";
import type { EnrichmentResult, CompanyVisit } from "@/lib/enrichment/types";
import { CLASS_TONE } from "@/lib/enrichment/score";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cnpj: string;
  prospectId?: string;
  companyName?: string;
}

type StepMap = Record<string, { status: StepEvent["status"]; message?: string }>;

export function EnrichmentDrawer({ open, onOpenChange, cnpj, prospectId, companyName }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [steps, setSteps] = useState<StepMap>({});

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setSteps({});
    if (!cnpj) return;
    loadExistingEnrichment(cnpj).then((r) => { if (r) setResult(r); }).catch(() => {});
  }, [open, cnpj]);

  const handleRun = async () => {
    if (!cnpj) { toast.error("CNPJ ausente"); return; }
    setLoading(true);
    setSteps({});
    try {
      const r = await runEnrichment(cnpj, {
        prospectId,
        onStep: (e) => setSteps((m) => ({ ...m, [e.step]: { status: e.status, message: e.message } })),
      });
      setResult(r);
      toast.success(`Enriquecido · ${r.score.classificacao}`);
    } catch (e) {
      toast.error(`Falha: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const progress = useMemo(() => {
    const done = Object.values(steps).filter((s) => s.status === "done" || s.status === "skipped").length;
    return Math.round((done / STEPS.length) * 100);
  }, [steps]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-glow" />
            Enriquecimento de Lead
          </SheetTitle>
          <SheetDescription>
            {companyName ?? "Empresa"} · CNPJ {cnpj || "—"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          <Button onClick={handleRun} disabled={loading || !cnpj} className="btn-gradient h-9">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {result ? "Re-enriquecer" : "Enriquecer agora"}
          </Button>
          {result && <ScoreBadge cls={result.score.classificacao} lead={result.score.lead_score} />}
        </div>

        {loading && (
          <div className="mt-3 space-y-2">
            <Progress value={progress} className="h-1.5" />
            <ul className="space-y-1 text-xs">
              {STEPS.map((s) => {
                const st = steps[s.id]?.status ?? "pending";
                const Icon = st === "done" ? CheckCircle2 : st === "error" ? AlertCircle : st === "running" ? Loader2 : Circle;
                const color = st === "done" ? "text-emerald-400" : st === "error" ? "text-rose-400" : st === "running" ? "text-primary-glow" : "text-muted-foreground";
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${color} ${st === "running" ? "animate-spin" : ""}`} />
                    <span className={color}>{s.label}</span>
                    {steps[s.id]?.message && <span className="text-muted-foreground">— {steps[s.id]?.message}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!result ? (
          <div className="mt-8 rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
            Clique em <strong>Enriquecer agora</strong> para buscar dados na Receita Federal, ViaCEP, OpenStreetMap e IBGE.
          </div>
        ) : (
          <Tabs defaultValue="perfil" className="mt-5">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="perfil"><Building2 className="mr-1 h-3.5 w-3.5" />Perfil</TabsTrigger>
              <TabsTrigger value="contato"><Phone className="mr-1 h-3.5 w-3.5" />Contato</TabsTrigger>
              <TabsTrigger value="local"><MapPin className="mr-1 h-3.5 w-3.5" />Local</TabsTrigger>
              <TabsTrigger value="ind"><Activity className="mr-1 h-3.5 w-3.5" />Indicadores</TabsTrigger>
              <TabsTrigger value="score"><Flame className="mr-1 h-3.5 w-3.5" />Score</TabsTrigger>
              <TabsTrigger value="pap"><Footprints className="mr-1 h-3.5 w-3.5" />Visitas</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="mt-4">
              <PerfilTab r={result} />
            </TabsContent>
            <TabsContent value="contato" className="mt-4">
              <ContatoTab r={result} />
            </TabsContent>
            <TabsContent value="local" className="mt-4">
              <LocalTab r={result} />
            </TabsContent>
            <TabsContent value="ind" className="mt-4">
              <IndicadoresTab r={result} />
            </TabsContent>
            <TabsContent value="score" className="mt-4">
              <ScoreTab r={result} />
            </TabsContent>
            <TabsContent value="pap" className="mt-4">
              <VisitasTab r={result} prospectId={prospectId} onChange={(visits) => setResult((cur) => cur ? { ...cur, visits } : cur)} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ScoreBadge({ cls, lead }: { cls: keyof typeof CLASS_TONE; lead: number }) {
  return (
    <Badge variant="outline" className={`${CLASS_TONE[cls]} border px-2.5 py-1`}>
      <Flame className="mr-1 h-3 w-3" /> {cls} · {lead}
    </Badge>
  );
}

function fmt(n?: number, opts?: Intl.NumberFormatOptions) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", opts).format(n);
}

function Row({ k, v }: { k: string; v?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v ?? "—"}</span>
    </div>
  );
}

function PerfilTab({ r }: { r: EnrichmentResult }) {
  const p = r.profile;
  return (
    <div className="space-y-4">
      <div className="surface-card p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
        <Row k="Razão Social" v={p.razao_social} />
        <Row k="Nome Fantasia" v={p.nome_fantasia} />
        <Row k="CNPJ" v={p.cnpj} />
        <Row k="Situação" v={p.situacao} />
        <Row k="Abertura" v={p.data_abertura} />
        <Row k="Natureza Jurídica" v={p.natureza_juridica} />
        <Row k="Porte" v={p.porte} />
        <Row k="Capital Social" v={fmt(p.capital_social, { style: "currency", currency: "BRL" })} />
      </div>
      <div className="surface-card p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">CNAE</p>
        <Row k="Principal" v={p.cnae_principal ? `${p.cnae_principal} — ${p.cnae_principal_desc}` : undefined} />
        {(p.cnaes_secundarios?.length ?? 0) > 0 && (
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {p.cnaes_secundarios!.slice(0, 8).map((c) => (
              <li key={c.codigo}>· {c.codigo} — {c.descricao}</li>
            ))}
          </ul>
        )}
      </div>
      {(p.socios?.length ?? 0) > 0 && (
        <div className="surface-card p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quadro Societário</p>
          <ul className="space-y-1 text-xs">
            {p.socios!.map((s, i) => (
              <li key={i} className="flex justify-between border-b border-border/40 py-1">
                <span>{s.nome}</span>
                <span className="text-muted-foreground">{s.qualificacao}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LocalTab({ r }: { r: EnrichmentResult }) {
  const a = r.address;
  const loc = r.location;
  const bbox = loc ? `${loc.lon - 0.01},${loc.lat - 0.01},${loc.lon + 0.01},${loc.lat + 0.01}` : null;
  return (
    <div className="space-y-4">
      <div className="surface-card p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
        <Row k="CEP" v={a?.cep} />
        <Row k="Logradouro" v={[a?.logradouro, a?.numero].filter(Boolean).join(", ")} />
        <Row k="Complemento" v={a?.complemento} />
        <Row k="Bairro" v={a?.bairro} />
        <Row k="Cidade / UF" v={a?.cidade ? `${a.cidade} - ${a?.uf ?? ""}` : a?.uf} />
        <Row k="Região" v={a?.regiao} />
      </div>
      {loc && bbox ? (
        <div className="surface-card overflow-hidden p-0">
          <iframe
            title="Mapa"
            className="h-64 w-full border-0"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${loc.lat},${loc.lon}`}
          />
          <div className="border-t border-border/40 p-2 text-[11px] text-muted-foreground">
            {loc.display_name ?? `${loc.lat}, ${loc.lon}`}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          Geolocalização não disponível.
        </div>
      )}
    </div>
  );
}

function IndicadoresTab({ r }: { r: EnrichmentResult }) {
  const m = r.market;
  if (!m) {
    return <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Indicadores IBGE não disponíveis para este município.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="População" value={fmt(m.populacao)} />
        <Metric label="PIB (R$)" value={fmt(m.pib_total, { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} />
        <Metric label="PIB per Capita" value={fmt(m.pib_per_capita, { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} />
        <Metric label="Município IBGE" value={`${m.cidade ?? "—"} / ${m.uf ?? ""}`} />
      </div>
      <p className="text-[11px] text-muted-foreground">Fonte: IBGE · Agregados 5938 (PIB) e 6579 (estimativa populacional).</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ScoreTab({ r }: { r: EnrichmentResult }) {
  const s = r.score;
  const items: { k: keyof typeof s.breakdown; label: string; weight: number }[] = [
    { k: "tempo_mercado", label: "Tempo de mercado", weight: 1 },
    { k: "porte", label: "Porte", weight: 2 },
    { k: "capital", label: "Capital social", weight: 3 },
    { k: "potencial_regiao", label: "Potencial regional", weight: 4 },
    { k: "presenca_digital", label: "Presença digital", weight: 5 },
    { k: "historico", label: "Histórico comercial", weight: 6 },
  ];
  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lead Score</p>
            <p className="mt-1 text-3xl font-bold">{s.lead_score}<span className="text-base text-muted-foreground">/100</span></p>
          </div>
          <ScoreBadge cls={s.classificacao} lead={s.lead_score} />
        </div>
        <Progress value={s.lead_score} className="mt-3 h-2" />
      </div>
      <div className="surface-card p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Market Score</p>
        <p className="text-2xl font-semibold">{s.market_score}<span className="text-sm text-muted-foreground">/100</span></p>
        <Progress value={s.market_score} className="mt-2 h-1.5" />
      </div>
      <div className="surface-card p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Decomposição</p>
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.k}>
              <div className="flex items-center justify-between text-xs">
                <span>{it.label} <span className="text-muted-foreground">(peso {it.weight})</span></span>
                <span className="font-medium">{s.breakdown[it.k]}</span>
              </div>
              <Progress value={s.breakdown[it.k]} className="mt-1 h-1" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}