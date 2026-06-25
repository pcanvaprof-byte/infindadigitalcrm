import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Copy, MessageCircle, Mail, ExternalLink, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBriefing, listBriefings, listKickoffsElegiveis, deleteBriefing, type KickoffElegivel,
} from "@/lib/briefings/api";
import {
  SERVICO_LABEL, STATUS_LABEL, type Briefing, type BriefingServico,
  type BriefingStatus, type BriefingTipo,
} from "@/lib/briefings/types";
import { crmKeys, invalidateCrmCore } from "@/lib/crm/api";
import { listClients } from "@/modules/lifecycle/api";
import { PIPELINE_STAGES, STAGE_LABEL, type PipelineStage } from "@/modules/lifecycle/types";

const FILTERS: { id: "todos" | BriefingStatus; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendente", label: "Pendentes" },
  { id: "em_preenchimento", label: "Em preenchimento" },
  { id: "concluido", label: "Concluídos" },
  { id: "cancelado", label: "Cancelados" },
];

function normalize(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function publicUrl(token: string) {
  if (typeof window === "undefined") return `/briefing/${token}`;
  return `${window.location.origin}/briefing/${token}`;
}

export function BriefingsDashboard({
  tipo,
  embedded = false,
  syncLifecycleStage = false,
}: {
  tipo: BriefingTipo;
  embedded?: boolean;
  /** Quando true, mostra um filtro extra por estágio do lifecycle do cliente. */
  syncLifecycleStage?: boolean;
}) {
  const isKickoff = tipo === "kickoff_producao";
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("todos");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"todos" | PipelineStage>("todos");
  const [createOpen, setCreateOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Briefing | null>(null);

  const briefingsQ = useQuery({
    queryKey: [...crmKeys.briefings, tipo],
    queryFn: () => listBriefings({ tipo }),
    staleTime: 10_000,
  });
  const lifecycleQ = useQuery({
    queryKey: ["lifecycle-clients"],
    queryFn: () => listClients(),
    enabled: syncLifecycleStage,
    staleTime: 30_000,
  });
  const stageByCompany = useMemo(() => {
    const m = new Map<string, PipelineStage>();
    (lifecycleQ.data ?? []).forEach((c) => {
      const key = normalize(c.company);
      if (key) m.set(key, c.pipeline_stage);
    });
    return m;
  }, [lifecycleQ.data]);
  const stageFor = (b: Briefing): PipelineStage | null =>
    stageByCompany.get(normalize(b.empresa)) ??
    stageByCompany.get(normalize(b.cliente_nome)) ??
    null;

  const items: Briefing[] = briefingsQ.data ?? [];
  const loading = briefingsQ.isLoading;

  const deleteMut = useMutation({
    mutationFn: (b: Briefing) => deleteBriefing(b.id),
    onSuccess: async () => {
      toast.success("Registro apagado");
      await invalidateCrmCore(qc);
    },
    onError: (e) => toast.error("Erro ao apagar", { description: (e as Error).message }),
  });
  const deleting = deleteMut.isPending ? deleteMut.variables?.id ?? null : null;

  async function handleDelete(b: Briefing) {
    const label = b.empresa || b.cliente_nome || "este registro";
    if (!window.confirm(`Apagar "${label}"? Esta ação não pode ser desfeita.`)) return;
    deleteMut.mutate(b);
  }

  const filtered = useMemo(() => items.filter((b) => {
    if (filter !== "todos" && b.status !== filter) return false;
    if (syncLifecycleStage && stageFilter !== "todos" && stageFor(b) !== stageFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return [b.cliente_nome, b.empresa, b.telefone, b.email].some((v) => (v ?? "").toLowerCase().includes(q));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, filter, query, stageFilter, stageByCompany, syncLifecycleStage]);

  const kpis = useMemo(() => {
    const total = items.length;
    const concluidos = items.filter((b) => b.status === "concluido").length;
    const taxa = total ? Math.round((concluidos / total) * 100) : 0;
    return { total, concluidos, taxa };
  }, [items]);

  const actions = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> {isKickoff ? "Criar Kickoff" : "Novo Briefing"}</Button>
      </DialogTrigger>
      <CreateDialog
        tipo={tipo}
        onCreated={(b) => {
          setCreateOpen(false);
          setShareTarget(b);
          void invalidateCrmCore(qc);
        }}
      />
    </Dialog>
  );

  const body = (
    <>
      {embedded && (
        <div className="mb-3 flex items-center justify-end">{actions}</div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label={isKickoff ? "Kickoffs criados" : "Briefings criados"} value={kpis.total} />
        <KpiCard label="Concluídos" value={kpis.concluidos} />
        <KpiCard label="Taxa de conclusão" value={`${kpis.taxa}%`} />
      </div>

      <div className="surface-card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>{FILTERS.map((f) => <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>)}</TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {syncLifecycleStage && (
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as typeof stageFilter)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Estágio do lifecycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os estágios</SelectItem>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome, empresa, telefone…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="surface-card mt-4 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              {syncLifecycleStage && <TableHead>Estágio</TableHead>}
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={syncLifecycleStage ? 7 : 6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={syncLifecycleStage ? 7 : 6} className="py-8 text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            ) : filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="font-medium">{b.cliente_nome ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{b.empresa ?? "—"}</div>
                </TableCell>
                <TableCell>{SERVICO_LABEL[b.servico]}</TableCell>
                <TableCell>{new Date(b.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell><StatusBadge status={b.status} /></TableCell>
                {syncLifecycleStage && (
                  <TableCell>
                    {(() => {
                      const st = stageFor(b);
                      return st ? (
                        <Badge variant="outline" className="text-[10px]">{STAGE_LABEL[st]}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      );
                    })()}
                  </TableCell>
                )}
                <TableCell>{b.responsavel ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setShareTarget(b)}>Compartilhar</Button>
                  <Link to="/briefings/$id" params={{ id: b.id }}>
                    <Button size="sm" variant="ghost">Abrir</Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={deleting === b.id}
                    onClick={() => void handleDelete(b)}
                    aria-label="Apagar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ShareDialog briefing={shareTarget} onClose={() => setShareTarget(null)} />
    </>
  );

  if (embedded) return body;

  return (
    <AppShell
      title={isKickoff ? "Kickoff de Produção" : "Briefings Comerciais"}
      subtitle={isKickoff
        ? "Coleta de acessos, materiais e metas após o fechamento."
        : "Gere, compartilhe e acompanhe briefings de pré-venda."}
      actions={actions}
    >
      {body}
    </AppShell>
  );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: BriefingStatus }) {
  const variant: Record<BriefingStatus, "secondary" | "default" | "destructive" | "outline"> = {
    pendente: "secondary", em_preenchimento: "default", concluido: "outline", cancelado: "destructive",
  };
  return <Badge variant={variant[status]}>{STATUS_LABEL[status]}</Badge>;
}

function CreateDialog({ tipo, onCreated }: { tipo: BriefingTipo; onCreated: (b: Briefing) => void }) {
  const isKickoff = tipo === "kickoff_producao";
  const [servico, setServico] = useState<BriefingServico>("gestao_trafego");
  const [form, setForm] = useState({
    cliente_nome: "", telefone: "", email: "", empresa: "", responsavel: "",
  });
  const [leadId, setLeadId] = useState<string | "">("");
  const [elegiveis, setElegiveis] = useState<KickoffElegivel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isKickoff) return;
    listKickoffsElegiveis()
      .then(setElegiveis)
      .catch(() => setElegiveis([]));
  }, [isKickoff]);

  function pickLead(id: string) {
    setLeadId(id);
    const lead = elegiveis.find((e) => e.id === id);
    if (lead) {
      setForm({
        cliente_nome: lead.owner || lead.company,
        empresa: lead.company,
        telefone: lead.phone || "",
        email: lead.email || "",
        responsavel: form.responsavel,
      });
    }
  }

  async function submit() {
    if (isKickoff && !leadId) { toast.error("Selecione um negócio Ganho."); return; }
    if (!form.cliente_nome.trim()) { toast.error("Informe o nome do cliente."); return; }
    setSaving(true);
    try {
      const b = await createBriefing({
        ...form,
        servico,
        tipo,
        lead_id: leadId || null,
      });
      toast.success(isKickoff ? "Kickoff criado!" : "Briefing criado!");
      onCreated(b);
    } catch (e) {
      console.error("[briefings] createBriefing failed", e);
      toast.error("Erro ao criar", { description: (e as Error).message });
    } finally { setSaving(false); }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isKickoff ? "Criar Kickoff de Produção" : "Criar Briefing Comercial"}</DialogTitle>
        <DialogDescription>
          {isKickoff
            ? "Selecione o negócio Ganho e o serviço contratado."
            : "Selecione o serviço e preencha os dados do cliente."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        {isKickoff && (
          <div className="grid gap-1.5">
            <Label>Negócio (Ganho)</Label>
            {elegiveis.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum prospect com status “Ganho” disponível. Atualize o CRM primeiro.
              </p>
            ) : (
              <Select value={leadId} onValueChange={pickLead}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {elegiveis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.company} · {p.owner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label>Serviço</Label>
          <Select value={servico} onValueChange={(v) => setServico(v as BriefingServico)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gestao_trafego">{SERVICO_LABEL.gestao_trafego}</SelectItem>
              <SelectItem value="pagina_vendas">{SERVICO_LABEL.pagina_vendas}</SelectItem>
              <SelectItem value="mentoria_trafego">{SERVICO_LABEL.mentoria_trafego}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Nome do cliente</Label>
          <Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Empresa</Label>
            <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Criando…" : isKickoff ? "Criar Kickoff" : "Criar Briefing"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ShareDialog({ briefing, onClose }: { briefing: Briefing | null; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!briefing) { setQr(null); return; }
    QRCode.toDataURL(publicUrl(briefing.token_publico), { width: 240, margin: 1 })
      .then(setQr).catch(() => setQr(null));
  }, [briefing]);

  if (!briefing) return null;
  const url = publicUrl(briefing.token_publico);
  const msg = encodeURIComponent(`Olá ${briefing.cliente_nome ?? ""}! Por favor preencha: ${url}`);
  return (
    <Dialog open={!!briefing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar</DialogTitle>
          <DialogDescription>Envie o link público para o cliente preencher.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {qr && <img src={qr} alt="QR Code" className="rounded border bg-white p-2" />}
          <div className="w-full break-all rounded bg-muted p-2 text-center text-xs">{url}</div>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-center">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
            <Copy className="mr-2 h-4 w-4" /> Copiar
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`https://wa.me/?text=${msg}`} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${briefing.email ?? ""}?subject=INFINDA&body=${msg}`}>
              <Mail className="mr-2 h-4 w-4" /> E-mail
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Visualizar</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}