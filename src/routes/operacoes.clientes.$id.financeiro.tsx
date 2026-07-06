import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Check, Plus, Sparkles, Trash2, Pencil, X, Calendar as CalendarIcon,
  TrendingUp, Wallet, AlertTriangle, Gift,
} from "lucide-react";
import {
  billingKeys, listBillingItems, createBillingItem, createManyBillingItems,
  updateBillingItem, deleteBillingItem, markAsPaid, summarize,
  buildImplantacaoPlan, buildMensalidadePlan,
  type BillingItem, type BillingStatus, type BillingTipo,
} from "@/lib/billing/api";

export const Route = createFileRoute("/operacoes/clientes/$id/financeiro")({
  ssr: false,
  component: FinanceiroPage,
});

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_META: Record<BillingStatus, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  pago: { label: "Pago", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  atrasado: { label: "Atrasado", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  bonificado: { label: "Bonificado", className: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" },
};

function effectiveStatus(it: BillingItem): BillingStatus {
  if (it.status !== "pendente") return it.status;
  return it.vencimento < todayISO() ? "atrasado" : "pendente";
}

function FinanceiroPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BillingItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  const q = useQuery({ queryKey: billingKeys.byClient(id), queryFn: () => listBillingItems(id) });
  const items = q.data ?? [];
  const s = useMemo(() => summarize(items), [items]);

  const invalidate = () => qc.invalidateQueries({ queryKey: billingKeys.byClient(id) });

  const markMut = useMutation({
    mutationFn: ({ id: itemId, metodo }: { id: string; metodo?: string }) => markAsPaid(itemId, metodo),
    onSuccess: () => { invalidate(); toast.success("Marcado como pago"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: deleteBillingItem,
    onSuccess: () => { invalidate(); toast.success("Parcela removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <SummaryCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Total contratado" value={BRL(s.total)} tone="default" />
        <SummaryCard icon={<Check className="h-3.5 w-3.5" />} label="Recebido" value={BRL(s.recebido)} tone="emerald" />
        <SummaryCard icon={<Wallet className="h-3.5 w-3.5" />} label="A receber" value={BRL(s.aReceber)} tone="amber" />
        <SummaryCard icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Atrasado" value={BRL(s.atrasado)} tone="rose" />
        <SummaryCard icon={<Gift className="h-3.5 w-3.5" />} label="Bonificado" value={BRL(s.bonificado)} tone="violet" />
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova parcela
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowPlan(true)}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Gerar plano rápido
        </Button>
      </div>

      {/* Lista */}
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Parcelas ({items.length})
          </p>
        </div>
        {q.isLoading ? (
          <p className="p-6 text-center text-xs text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma parcela cadastrada.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use "Gerar plano rápido" para criar Nx parcelas de uma vez.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => {
              const st = effectiveStatus(it);
              const meta = STATUS_META[st];
              return (
                <div key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{it.descricao}</p>
                      <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
                        {meta.label}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">{it.tipo}</Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" /> Vence {fmtDate(it.vencimento)}
                      {it.pago_em && ` · pago em ${new Date(it.pago_em).toLocaleDateString("pt-BR")}`}
                      {it.metodo && ` · ${it.metodo}`}
                    </p>
                    {it.observacao && (
                      <p className="mt-0.5 text-[11px] italic text-muted-foreground">{it.observacao}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{BRL(Number(it.valor))}</p>
                  </div>
                  <div className="flex gap-1">
                    {it.status !== "pago" && it.status !== "bonificado" && it.status !== "cancelado" && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600"
                        onClick={() => markMut.mutate({ id: it.id })}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(it)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600"
                      onClick={() => confirm("Remover esta parcela?") && delMut.mutate(it.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showAdd && <BillingItemDialog clientId={id} onClose={() => { setShowAdd(false); invalidate(); }} />}
      {editing && <BillingItemDialog clientId={id} item={editing} onClose={() => { setEditing(null); invalidate(); }} />}
      {showPlan && <PlanGeneratorDialog clientId={id} onClose={() => { setShowPlan(false); invalidate(); }} />}

      <p className="text-[11px] text-muted-foreground">
        💡 Integração com gateway (Asaas / Pagar.me) fica para uma próxima etapa.
        Por enquanto o controle é manual — marque como pago quando o valor cair.
      </p>
    </div>
  );
}

function SummaryCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode; label: string; value: string;
  tone: "default" | "emerald" | "amber" | "rose" | "violet";
}) {
  const toneClass = {
    default: "",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    violet: "text-violet-600 dark:text-violet-400",
  }[tone];
  return (
    <Card className="p-3">
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${toneClass || "text-muted-foreground"}`}>
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-base font-bold tabular-nums ${toneClass}`}>{value}</p>
    </Card>
  );
}

// -------- Dialog: criar / editar parcela --------
function BillingItemDialog({
  clientId, item, onClose,
}: { clientId: string; item?: BillingItem; onClose: () => void }) {
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [tipo, setTipo] = useState<BillingTipo>(item?.tipo ?? "avulso");
  const [valor, setValor] = useState(String(item?.valor ?? ""));
  const [vencimento, setVencimento] = useState(item?.vencimento ?? todayISO());
  const [status, setStatus] = useState<BillingStatus>(item?.status ?? "pendente");
  const [metodo, setMetodo] = useState(item?.metodo ?? "");
  const [observacao, setObservacao] = useState(item?.observacao ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        descricao: descricao.trim(),
        tipo, valor: Number(valor) || 0, vencimento, status,
        metodo: metodo.trim() || null,
        observacao: observacao.trim() || null,
        ordem: item?.ordem ?? 0,
      };
      if (!payload.descricao) { toast.error("Descrição obrigatória"); setSaving(false); return; }
      if (item) await updateBillingItem(item.id, payload);
      else await createBillingItem(payload);
      toast.success(item ? "Parcela atualizada" : "Parcela criada");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Editar parcela" : "Nova parcela"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Site — 1ª parcela" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as BillingTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="implantacao">Implantação</SelectItem>
                  <SelectItem value="mensalidade">Mensalidade</SelectItem>
                  <SelectItem value="avulso">Avulso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as BillingStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="bonificado">Bonificado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Método (opcional)</Label>
            <Input value={metodo} onChange={(e) => setMetodo(e.target.value)} placeholder="PIX, boleto, cartão…" />
          </div>
          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><X className="mr-1 h-4 w-4" /> Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------- Dialog: gerador de plano rápido --------
function PlanGeneratorDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [modo, setModo] = useState<"implantacao" | "mensalidade">("implantacao");
  const [descricao, setDescricao] = useState("Site");
  const [valor, setValor] = useState("1500");
  const [parcelas, setParcelas] = useState("2");
  const [dataInicial, setDataInicial] = useState(todayISO());
  const [intervaloDias, setIntervaloDias] = useState("15");
  const [bonificar, setBonificar] = useState("0");
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    if (modo === "implantacao") {
      return buildImplantacaoPlan({
        clientId, valorTotal: Number(valor) || 0,
        parcelas: Math.max(1, Number(parcelas) || 1),
        dataInicial, intervaloDias: Number(intervaloDias) || 0,
        descricaoBase: descricao || "Implantação",
      });
    }
    return buildMensalidadePlan({
      clientId, valorMensal: Number(valor) || 0,
      meses: Math.max(1, Number(parcelas) || 1),
      dataInicial, descricaoBase: descricao || "Mensalidade",
      bonificarPrimeirosMeses: Number(bonificar) || 0,
    });
  }, [clientId, modo, valor, parcelas, dataInicial, intervaloDias, descricao, bonificar]);

  const gerar = async () => {
    setSaving(true);
    try {
      await createManyBillingItems(preview);
      toast.success(`${preview.length} parcela(s) criada(s)`);
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar plano rápido</DialogTitle>
          <DialogDescription>
            Cria N parcelas de uma vez. Ex: R$1500 em 2x (sexta + 15 dias), ou mensalidade em 3x com bonificação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Modelo</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="implantacao">Implantação em Nx parcelas</SelectItem>
                <SelectItem value="mensalidade">Mensalidade recorrente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Descrição base</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">
                {modo === "implantacao" ? "Valor total (R$)" : "Valor mensal (R$)"}
              </Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{modo === "implantacao" ? "Nº parcelas" : "Nº meses"}</Label>
              <Input type="number" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
            </div>
            {modo === "implantacao" ? (
              <div>
                <Label className="text-xs">Intervalo (dias)</Label>
                <Input type="number" value={intervaloDias} onChange={(e) => setIntervaloDias(e.target.value)} />
              </div>
            ) : (
              <div>
                <Label className="text-xs">Bonif. 1ºs meses</Label>
                <Input type="number" value={bonificar} onChange={(e) => setBonificar(e.target.value)} />
              </div>
            )}
          </div>

          <div className="max-h-52 overflow-auto rounded border border-border bg-muted/20 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Preview ({preview.length})</p>
            {preview.map((p, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/50 py-1 text-xs last:border-0">
                <span className="truncate">{p.descricao}</span>
                <span className="ml-2 whitespace-nowrap text-muted-foreground">
                  {fmtDate(p.vencimento)} · <b className="text-foreground">{BRL(p.valor)}</b>
                  {p.status === "bonificado" && <span className="ml-1 text-violet-500">🎁</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={gerar} disabled={saving || preview.length === 0}>
            {saving ? "Criando…" : `Criar ${preview.length} parcela(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}