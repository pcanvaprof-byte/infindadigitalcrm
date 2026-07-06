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
  Check, Plus, Sparkles, Trash2, Pencil, Copy, X, Calendar as CalendarIcon,
  TrendingUp, Wallet, AlertTriangle, Gift,
} from "lucide-react";
import {
  billingKeys, listBillingItems, createBillingItem, createManyBillingItems,
  updateBillingItem, deleteBillingItem, markAsPaid, summarize,
  buildImplantacaoPlan, buildMensalidadePlan,
  validateBillingPlan,
  type BillingItem, type BillingStatus, type BillingTipo,
  listBillingPresets, createBillingPreset, updateBillingPreset, deleteBillingPreset,
  type BillingPreset, type BillingPresetInput,
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

const MONTH_LABEL = (ym: string) => {
  const [y, m] = ym.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
};

function summarizeByMonth(items: BillingItem[]) {
  const today = todayISO();
  const map = new Map<string, { recebido: number; aReceber: number; atrasado: number; bonificado: number; total: number }>();
  for (const it of items) {
    const ym = it.vencimento.slice(0, 7);
    const bucket = map.get(ym) ?? { recebido: 0, aReceber: 0, atrasado: 0, bonificado: 0, total: 0 };
    const v = Number(it.valor) || 0;
    if (it.status === "cancelado") { /* skip */ }
    else if (it.status === "pago") bucket.recebido += v;
    else if (it.status === "bonificado") bucket.bonificado += v;
    else if (it.vencimento < today) bucket.atrasado += v;
    else bucket.aReceber += v;
    if (it.status !== "cancelado") bucket.total += v;
    map.set(ym, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, v]) => ({ ym, ...v }));
}

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
  const porMes = useMemo(() => summarizeByMonth(items), [items]);

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

      {/* Fluxo de caixa por mês */}
      {porMes.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
            <p className="text-xs font-semibold text-muted-foreground">Fluxo de caixa por mês</p>
            <p className="text-[10px] text-muted-foreground">{porMes.length} mês(es)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">Mês</th>
                  <th className="px-3 py-1.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">Recebido</th>
                  <th className="px-3 py-1.5 text-right font-semibold text-amber-600 dark:text-amber-400">A receber</th>
                  <th className="px-3 py-1.5 text-right font-semibold text-rose-600 dark:text-rose-400">Atrasado</th>
                  <th className="px-3 py-1.5 text-right font-semibold text-violet-600 dark:text-violet-400">Bonificado</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {porMes.map((m) => (
                  <tr key={m.ym} className="hover:bg-accent/30">
                    <td className="px-3 py-1.5 font-medium">{MONTH_LABEL(m.ym)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.recebido ? BRL(m.recebido) : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{m.aReceber ? BRL(m.aReceber) : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{m.atrasado ? BRL(m.atrasado) : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-violet-600 dark:text-violet-400">{m.bonificado ? BRL(m.bonificado) : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{BRL(m.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border bg-muted/20 text-[11px] font-semibold">
                <tr>
                  <td className="px-3 py-1.5">Total</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{BRL(s.recebido)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{BRL(s.aReceber)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{BRL(s.atrasado)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-violet-600 dark:text-violet-400">{BRL(s.bonificado)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{BRL(s.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

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
      {editing && <BillingItemDialog clientId={id} item={editing} existing={items} onClose={() => { setEditing(null); invalidate(); }} />}
      {showPlan && <PlanGeneratorDialog clientId={id} existing={items} onClose={() => { setShowPlan(false); invalidate(); }} />}

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
  clientId, item, existing, onClose,
}: { clientId: string; item?: BillingItem; existing?: BillingItem[]; onClose: () => void }) {
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
      const others = (existing ?? []).filter((e) => e.id !== item?.id);
      const errs = validateBillingPlan([payload], others);
      if (errs.length) {
        toast.error(errs[0], { description: errs.slice(1, 4).join(" · ") || undefined });
        setSaving(false);
        return;
      }
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
function PlanGeneratorDialog({ clientId, existing, onClose }: { clientId: string; existing?: BillingItem[]; onClose: () => void }) {
  const qc = useQueryClient();
  const presetsQ = useQuery({ queryKey: billingKeys.presets, queryFn: listBillingPresets });
  const presets = presetsQ.data ?? [];
  const [presetId, setPresetId] = useState<string>("none");
  const activePreset = presetId !== "none" ? presets.find((p) => p.id === presetId) ?? null : null;
  const [presetEditor, setPresetEditor] = useState<
    | { mode: "create"; initial?: BillingPresetInput }
    | { mode: "edit"; preset: BillingPreset }
    | { mode: "duplicate"; initial: BillingPresetInput }
    | null
  >(null);

  // ---- Estado do preset combinado (Site + Mentoria) ----
  const [pSiteDesc, setPSiteDesc] = useState("Site");
  const [pSiteValor, setPSiteValor] = useState("1500");
  const [pSiteParcelas, setPSiteParcelas] = useState("2");
  const [pSiteIntervalo, setPSiteIntervalo] = useState("15");
  const [pMentDesc, setPMentDesc] = useState("Mentoria");
  const [pMentValor, setPMentValor] = useState("500");
  const [pMentMeses, setPMentMeses] = useState("6");
  const [pMentBonif, setPMentBonif] = useState("3");
  const [pDataInicial, setPDataInicial] = useState(todayISO());

  // ---- Estado do modo single (padrão) ----
  const [modo, setModo] = useState<"implantacao" | "mensalidade">("implantacao");
  const [descricao, setDescricao] = useState("Site");
  const [valor, setValor] = useState("1500");
  const [parcelas, setParcelas] = useState("2");
  const [dataInicial, setDataInicial] = useState(todayISO());
  const [intervaloDias, setIntervaloDias] = useState("15");
  const [bonificar, setBonificar] = useState("0");
  const [saving, setSaving] = useState(false);

  const applyPreset = (id: string) => {
    setPresetId(id);
    if (id === "none") return;
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setPSiteDesc(p.site_descricao);
    setPSiteValor(String(p.site_valor));
    setPSiteParcelas(String(p.site_parcelas));
    setPSiteIntervalo(String(p.site_intervalo_dias));
    setPMentDesc(p.mentoria_descricao);
    setPMentValor(String(p.mentoria_valor));
    setPMentMeses(String(p.mentoria_meses));
    setPMentBonif(String(p.mentoria_bonif));
  };

  const currentFormAsPreset = (): BillingPresetInput => ({
    nome: "",
    site_descricao: pSiteDesc || "Site",
    site_valor: Number(pSiteValor) || 0,
    site_parcelas: Math.max(1, Number(pSiteParcelas) || 1),
    site_intervalo_dias: Number(pSiteIntervalo) || 0,
    mentoria_descricao: pMentDesc || "Mentoria",
    mentoria_valor: Number(pMentValor) || 0,
    mentoria_meses: Math.max(1, Number(pMentMeses) || 1),
    mentoria_bonif: Number(pMentBonif) || 0,
  });

  const removeActivePreset = async () => {
    if (!activePreset) return;
    if (!confirm(`Excluir o preset "${activePreset.nome}"?`)) return;
    try {
      await deleteBillingPreset(activePreset.id);
      await qc.invalidateQueries({ queryKey: billingKeys.presets });
      setPresetId("none");
      toast.success("Preset excluído");
    } catch (e) { toast.error((e as Error).message); }
  };

  const duplicateActivePreset = () => {
    if (!activePreset) return;
    const initial: BillingPresetInput = {
      nome: `${activePreset.nome} (cópia)`,
      site_descricao: activePreset.site_descricao,
      site_valor: activePreset.site_valor,
      site_parcelas: activePreset.site_parcelas,
      site_intervalo_dias: activePreset.site_intervalo_dias,
      mentoria_descricao: activePreset.mentoria_descricao,
      mentoria_valor: activePreset.mentoria_valor,
      mentoria_meses: activePreset.mentoria_meses,
      mentoria_bonif: activePreset.mentoria_bonif,
    };
    setPresetEditor({ mode: "duplicate", initial });
  };

  const preview = useMemo(() => {
    if (activePreset) {
      const site = buildImplantacaoPlan({
        clientId,
        valorTotal: Number(pSiteValor) || 0,
        parcelas: Math.max(1, Number(pSiteParcelas) || 1),
        dataInicial: pDataInicial,
        intervaloDias: Number(pSiteIntervalo) || 0,
        descricaoBase: pSiteDesc || "Site",
      });
      const ment = buildMensalidadePlan({
        clientId,
        valorMensal: Number(pMentValor) || 0,
        meses: Math.max(1, Number(pMentMeses) || 1),
        dataInicial: pDataInicial,
        descricaoBase: pMentDesc || "Mentoria",
        bonificarPrimeirosMeses: Number(pMentBonif) || 0,
      });
      return [...site, ...ment];
    }
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
  }, [
    clientId, modo, valor, parcelas, dataInicial, intervaloDias, descricao, bonificar,
    activePreset, pSiteDesc, pSiteValor, pSiteParcelas, pSiteIntervalo,
    pMentDesc, pMentValor, pMentMeses, pMentBonif, pDataInicial,
  ]);

  const expectedTotal = useMemo(() => {
    if (activePreset) {
      const site = Number(pSiteValor) || 0;
      const mentBrutoMeses = Math.max(0, (Number(pMentMeses) || 0) - (Number(pMentBonif) || 0));
      return site + mentBrutoMeses * (Number(pMentValor) || 0);
    }
    if (modo === "implantacao") return Number(valor) || 0;
    const meses = Math.max(0, (Number(parcelas) || 0) - (Number(bonificar) || 0));
    return meses * (Number(valor) || 0);
  }, [activePreset, pSiteValor, pMentValor, pMentMeses, pMentBonif, modo, valor, parcelas, bonificar]);

  const validationErrors = useMemo(
    () => validateBillingPlan(preview, existing ?? [], { expectedTotal }),
    [preview, existing, expectedTotal],
  );

  const gerar = async () => {
    if (validationErrors.length) {
      toast.error("Corrija os erros antes de salvar", { description: validationErrors[0] });
      return;
    }
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
            <Label className="text-xs">Preset</Label>
            <div className="flex items-center gap-2">
              <Select value={presetId} onValueChange={applyPreset}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Sem preset" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem preset (configurar manualmente)</SelectItem>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setPresetEditor({ mode: "create" })}
                title="Salvar valores atuais como novo preset"
              >
                <Plus className="h-3.5 w-3.5" /> Novo
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                disabled={!activePreset}
                onClick={() => activePreset && setPresetEditor({ mode: "edit", preset: activePreset })}
                title="Editar preset selecionado"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                disabled={!activePreset}
                onClick={duplicateActivePreset}
                title="Duplicar preset selecionado e ajustar valores"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                disabled={!activePreset}
                onClick={removeActivePreset}
                title="Excluir preset selecionado"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Presets ficam salvos e podem ser reusados em qualquer cliente.
            </p>
          </div>

          {activePreset ? (
            <>
              <div className="rounded border border-border bg-muted/20 p-2">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Site (implantação)</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Descrição</Label>
                    <Input value={pSiteDesc} onChange={(e) => setPSiteDesc(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Total (R$)</Label>
                    <Input type="number" step="0.01" value={pSiteValor} onChange={(e) => setPSiteValor(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Parcelas</Label>
                    <Input type="number" value={pSiteParcelas} onChange={(e) => setPSiteParcelas(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Intervalo (dias)</Label>
                    <Input type="number" value={pSiteIntervalo} onChange={(e) => setPSiteIntervalo(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="rounded border border-border bg-muted/20 p-2">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mentoria (mensalidade)</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Descrição</Label>
                    <Input value={pMentDesc} onChange={(e) => setPMentDesc(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Valor mensal (R$)</Label>
                    <Input type="number" step="0.01" value={pMentValor} onChange={(e) => setPMentValor(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Meses</Label>
                    <Input type="number" value={pMentMeses} onChange={(e) => setPMentMeses(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Bonif. 1ºs meses</Label>
                    <Input type="number" value={pMentBonif} onChange={(e) => setPMentBonif(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs">Data inicial (aplica aos dois)</Label>
                <Input type="date" value={pDataInicial} onChange={(e) => setPDataInicial(e.target.value)} />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

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

          {validationErrors.length > 0 && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3" /> {validationErrors.length} problema(s)
              </p>
              <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-rose-700 dark:text-rose-300">
                {validationErrors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
                {validationErrors.length > 6 && <li>… e mais {validationErrors.length - 6}</li>}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={gerar} disabled={saving || preview.length === 0 || validationErrors.length > 0}>
            {saving ? "Criando…" : `Criar ${preview.length} parcela(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
      {presetEditor && (
        <PresetEditorDialog
          mode={presetEditor.mode}
          initial={
            presetEditor.mode === "edit" && presetEditor.preset
              ? presetEditor.preset
              : presetEditor.mode === "duplicate"
                ? presetEditor.initial
                : { ...currentFormAsPreset(), nome: "" }
          }
          onClose={() => setPresetEditor(null)}
          onSaved={async (saved) => {
            await qc.invalidateQueries({ queryKey: billingKeys.presets });
            setPresetEditor(null);
            applyPreset(saved.id);
          }}
        />
      )}
    </Dialog>
  );
}

function PresetEditorDialog({
  mode, initial, onClose, onSaved,
}: {
  mode: "create" | "edit" | "duplicate";
  initial: BillingPresetInput | BillingPreset;
  onClose: () => void;
  onSaved: (p: BillingPreset) => void;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [siteDesc, setSiteDesc] = useState(initial.site_descricao);
  const [siteValor, setSiteValor] = useState(String(initial.site_valor));
  const [siteParcelas, setSiteParcelas] = useState(String(initial.site_parcelas));
  const [siteIntervalo, setSiteIntervalo] = useState(String(initial.site_intervalo_dias));
  const [mentDesc, setMentDesc] = useState(initial.mentoria_descricao);
  const [mentValor, setMentValor] = useState(String(initial.mentoria_valor));
  const [mentMeses, setMentMeses] = useState(String(initial.mentoria_meses));
  const [mentBonif, setMentBonif] = useState(String(initial.mentoria_bonif));
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) { toast.error("Informe um nome para o preset"); return; }
    setSaving(true);
    try {
      const payload: BillingPresetInput = {
        nome: nome.trim(),
        site_descricao: siteDesc || "Site",
        site_valor: Number(siteValor) || 0,
        site_parcelas: Math.max(1, Number(siteParcelas) || 1),
        site_intervalo_dias: Number(siteIntervalo) || 0,
        mentoria_descricao: mentDesc || "Mentoria",
        mentoria_valor: Number(mentValor) || 0,
        mentoria_meses: Math.max(1, Number(mentMeses) || 1),
        mentoria_bonif: Number(mentBonif) || 0,
      };
      const saved = mode === "edit" && "id" in initial
        ? await updateBillingPreset(initial.id, payload)
        : await createBillingPreset(payload);
      toast.success(
        mode === "edit" ? "Preset atualizado"
        : mode === "duplicate" ? "Preset duplicado"
        : "Preset criado"
      );
      onSaved(saved);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar preset"
             : mode === "duplicate" ? "Duplicar preset"
             : "Novo preset"}
          </DialogTitle>
          <DialogDescription>
            {mode === "duplicate"
              ? "Ajuste o nome e os valores. O preset original permanece inalterado."
              : "Presets ficam disponíveis para qualquer cliente."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do preset</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Site 2x + Mentoria 6m" />
          </div>
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Site (implantação)</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Descrição</Label>
                <Input value={siteDesc} onChange={(e) => setSiteDesc(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Total (R$)</Label>
                <Input type="number" step="0.01" value={siteValor} onChange={(e) => setSiteValor(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Parcelas</Label>
                <Input type="number" value={siteParcelas} onChange={(e) => setSiteParcelas(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Intervalo (dias)</Label>
                <Input type="number" value={siteIntervalo} onChange={(e) => setSiteIntervalo(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mentoria (mensalidade)</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Descrição</Label>
                <Input value={mentDesc} onChange={(e) => setMentDesc(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor mensal</Label>
                <Input type="number" step="0.01" value={mentValor} onChange={(e) => setMentValor(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Meses</Label>
                <Input type="number" value={mentMeses} onChange={(e) => setMentMeses(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Bonif. 1ºs meses</Label>
                <Input type="number" value={mentBonif} onChange={(e) => setMentBonif(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : (mode === "edit" ? "Salvar alterações" : "Criar preset")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}