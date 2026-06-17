import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
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
import { Plus, Copy, MessageCircle, Mail, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { createBriefing, listBriefings } from "@/lib/briefings/api";
import {
  SERVICO_LABEL, STATUS_LABEL, type Briefing, type BriefingServico, type BriefingStatus,
} from "@/lib/briefings/types";

export const Route = createFileRoute("/briefings")({
  head: () => ({ meta: [{ title: "Briefings — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <BriefingsPage />
    </RequireAuth>
  ),
});

const FILTERS: { id: "todos" | BriefingStatus; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendente", label: "Pendentes" },
  { id: "em_preenchimento", label: "Em preenchimento" },
  { id: "concluido", label: "Concluídos" },
  { id: "cancelado", label: "Cancelados" },
];

function publicUrl(token: string) {
  if (typeof window === "undefined") return `/briefing/${token}`;
  return `${window.location.origin}/briefing/${token}`;
}

function BriefingsPage() {
  const [items, setItems] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("todos");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Briefing | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setItems(await listBriefings());
    } catch (e) {
      toast.error("Não foi possível carregar briefings", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => {
    return items.filter((b) => {
      if (filter !== "todos" && b.status !== filter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return [b.cliente_nome, b.empresa, b.telefone, b.email]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [items, filter, query]);

  const kpis = useMemo(() => {
    const total = items.length;
    const concluidos = items.filter((b) => b.status === "concluido").length;
    const taxa = total ? Math.round((concluidos / total) * 100) : 0;
    return { total, concluidos, taxa };
  }, [items]);

  return (
    <AppShell
      title="Briefings"
      subtitle="Gere, compartilhe e acompanhe briefings inteligentes."
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Criar Briefing</Button>
          </DialogTrigger>
          <CreateBriefingDialog
            onCreated={(b) => {
              setCreateOpen(false);
              setShareTarget(b);
              void reload();
            }}
          />
        </Dialog>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Briefings criados" value={kpis.total} />
        <KpiCard label="Concluídos" value={kpis.concluidos} />
        <KpiCard label="Taxa de conclusão" value={`${kpis.taxa}%`} />
      </div>

      <div className="surface-card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, empresa, telefone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum briefing.</TableCell></TableRow>
            ) : filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="font-medium">{b.cliente_nome ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{b.empresa ?? "—"}</div>
                </TableCell>
                <TableCell>{SERVICO_LABEL[b.servico]}</TableCell>
                <TableCell>{new Date(b.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell><StatusBadge status={b.status} /></TableCell>
                <TableCell>{b.responsavel ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setShareTarget(b)}>
                    Compartilhar
                  </Button>
                  <Link to="/briefings/$id" params={{ id: b.id }}>
                    <Button size="sm" variant="ghost">Abrir</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ShareDialog briefing={shareTarget} onClose={() => setShareTarget(null)} />
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
    pendente: "secondary",
    em_preenchimento: "default",
    concluido: "outline",
    cancelado: "destructive",
  };
  return <Badge variant={variant[status]}>{STATUS_LABEL[status]}</Badge>;
}

function CreateBriefingDialog({ onCreated }: { onCreated: (b: Briefing) => void }) {
  const [servico, setServico] = useState<BriefingServico>("pagina_vendas");
  const [form, setForm] = useState({
    cliente_nome: "", telefone: "", email: "", empresa: "", responsavel: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.cliente_nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      const b = await createBriefing({ ...form, servico });
      toast.success("Briefing criado!");
      onCreated(b);
    } catch (e) {
      toast.error("Erro ao criar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Criar Briefing</DialogTitle>
        <DialogDescription>Selecione o serviço e preencha os dados do cliente.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Serviço</Label>
          <Select value={servico} onValueChange={(v) => setServico(v as BriefingServico)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pagina_vendas">{SERVICO_LABEL.pagina_vendas}</SelectItem>
              <SelectItem value="mentoria_trafego">{SERVICO_LABEL.mentoria_trafego}</SelectItem>
              <SelectItem value="gestao_trafego">{SERVICO_LABEL.gestao_trafego}</SelectItem>
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
            <Label>Responsável comercial</Label>
            <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Criando…" : "Criar Briefing"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ShareDialog({ briefing, onClose }: { briefing: Briefing | null; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!briefing) { setQr(null); return; }
    QRCode.toDataURL(publicUrl(briefing.token_publico), { width: 240, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [briefing]);

  if (!briefing) return null;
  const url = publicUrl(briefing.token_publico);
  const msg = encodeURIComponent(`Olá ${briefing.cliente_nome ?? ""}! Por favor preencha o briefing da INFINDA Digital: ${url}`);
  return (
    <Dialog open={!!briefing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar briefing</DialogTitle>
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
            <a href={`mailto:${briefing.email ?? ""}?subject=Briefing INFINDA&body=${msg}`}>
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