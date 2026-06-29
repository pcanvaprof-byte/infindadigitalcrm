import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listClientes } from "@/modules/operacoes/api";
import {
  deleteOpCampaign, listOpCampaigns, upsertOpCampaign,
} from "@/modules/operacoes/fase2.api";
import {
  OP_CAMPAIGN_PLATFORMS, OP_CAMPAIGN_STATUS_LABEL,
  type OpCampaign, type OpCampaignPlatform, type OpCampaignStatus,
} from "@/modules/operacoes/fase2.types";

const STATUS_STYLES: Record<OpCampaignStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  ativa: "bg-emerald-500/15 text-emerald-400",
  pausada: "bg-amber-500/15 text-amber-400",
  encerrada: "bg-red-500/15 text-red-400",
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function CampanhasView({ clientId }: { clientId?: string }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<OpCampaignStatus | "">("");
  const [editing, setEditing] = useState<OpCampaign | null>(null);
  const [creating, setCreating] = useState(false);

  const clientesQ = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });
  const camps = useQuery({
    queryKey: ["op-campaigns", { clientId, status }],
    queryFn: () => listOpCampaigns({ clientId: clientId || undefined, status: status || undefined }),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deleteOpCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-campaigns"] });
      qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
      toast.success("Campanha removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = (camps.data ?? []).reduce(
    (a, c) => ({
      monthly: a.monthly + Number(c.monthly_budget || 0),
      invest: a.invest + Number(c.investment_to_date || 0),
      results: a.results + Number(c.results_count || 0),
    }),
    { monthly: 0, invest: 0, results: 0 },
  );

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Verba mensal" value={fmt(totals.monthly)} />
        <KpiCard label="Investido" value={fmt(totals.invest)} />
        <KpiCard label="Resultados" value={totals.results.toLocaleString("pt-BR")} />
        <KpiCard label="Campanhas" value={`${camps.data?.length ?? 0}`} />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={status || "__all"} onValueChange={(v) => setStatus(v === "__all" ? "" : v as OpCampaignStatus)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos status</SelectItem>
            {Object.entries(OP_CAMPAIGN_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreating(true)} disabled={!clientesQ.data?.length}>
          <Plus className="mr-2 h-4 w-4" /> Nova campanha
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Campanha</th>
                <th className="px-3 py-2 text-left">Plataforma</th>
                <th className="px-3 py-2 text-right">Verba/mês</th>
                <th className="px-3 py-2 text-right">Investido</th>
                <th className="px-3 py-2 text-right">Resultados</th>
                <th className="px-3 py-2 text-right">CPR</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {camps.isLoading && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!camps.isLoading && (camps.data ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhuma campanha.</td></tr>
              )}
              {(camps.data ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border/60 hover:bg-background/30">
                  <td className="px-3 py-2 font-medium text-foreground">{c.campaign_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.platform}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(c.monthly_budget || 0))}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(c.investment_to_date || 0))}</td>
                  <td className="px-3 py-2 text-right">{Number(c.results_count || 0).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(c.cost_per_result || 0))}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[c.status]}`}>
                      {OP_CAMPAIGN_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm("Remover campanha?")) delM.mutate(c.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CampaignDialog
        open={creating || !!editing}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
        campaign={editing}
        clientes={clientesQ.data ?? []}
        lockedClientId={clientId}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["op-campaigns"] });
          qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
        }}
      />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </Card>
  );
}

function CampaignDialog({
  open, onOpenChange, campaign, clientes, onSaved, lockedClientId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: OpCampaign | null;
  clientes: { id: string; nome: string }[];
  onSaved: () => void;
  lockedClientId?: string;
}) {
  const empty = {
    client_id: lockedClientId ?? "", campaign_name: "",
    platform: "Meta Ads" as OpCampaignPlatform,
    objective: "",
    daily_budget: 0, monthly_budget: 0,
    investment_to_date: 0, results_count: 0, cost_per_result: 0,
    status: "rascunho" as OpCampaignStatus,
    start_date: "", end_date: "",
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (campaign) {
      setForm({
        client_id: campaign.client_id,
        campaign_name: campaign.campaign_name,
        platform: campaign.platform,
        objective: campaign.objective ?? "",
        daily_budget: Number(campaign.daily_budget || 0),
        monthly_budget: Number(campaign.monthly_budget || 0),
        investment_to_date: Number(campaign.investment_to_date || 0),
        results_count: Number(campaign.results_count || 0),
        cost_per_result: Number(campaign.cost_per_result || 0),
        status: campaign.status,
        start_date: campaign.start_date ?? "",
        end_date: campaign.end_date ?? "",
      });
    } else if (open) setForm({ ...empty, client_id: lockedClientId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, open, lockedClientId]);

  const m = useMutation({
    mutationFn: () => upsertOpCampaign({ ...form, id: campaign?.id }),
    onSuccess: () => {
      toast.success(campaign ? "Campanha atualizada" : "Campanha criada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{campaign ? "Editar campanha" : "Nova campanha"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            {!lockedClientId && (
              <div>
                <label className="text-xs text-muted-foreground">Cliente *</label>
                <Select value={form.client_id || undefined} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))} disabled={!!campaign}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Plataforma</label>
              <Select value={form.platform} onValueChange={(v) => setForm((f) => ({ ...f, platform: v as OpCampaignPlatform }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OP_CAMPAIGN_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nome da campanha *</label>
            <Input value={form.campaign_name} onChange={(e) => setForm((f) => ({ ...f, campaign_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Objetivo</label>
            <Input value={form.objective} onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Verba diária" v={form.daily_budget} on={(v) => setForm((f) => ({ ...f, daily_budget: v }))} />
            <NumField label="Verba mensal" v={form.monthly_budget} on={(v) => setForm((f) => ({ ...f, monthly_budget: v }))} />
            <NumField label="Investido até hoje" v={form.investment_to_date} on={(v) => setForm((f) => ({ ...f, investment_to_date: v }))} />
            <NumField label="Resultados" v={form.results_count} on={(v) => setForm((f) => ({ ...f, results_count: v }))} />
            <NumField label="Custo / resultado" v={form.cost_per_result} on={(v) => setForm((f) => ({ ...f, cost_per_result: v }))} />
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as OpCampaignStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(OP_CAMPAIGN_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Início</label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fim</label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.client_id || !form.campaign_name.trim()}>
            {m.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumField({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type="number" step="0.01" value={v}
        onChange={(e) => on(Number(e.target.value) || 0)} />
    </div>
  );
}