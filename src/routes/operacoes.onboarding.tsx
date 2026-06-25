import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { listClientes } from "@/modules/operacoes/api";
import {
  listOnboardings, listOnboardingProgress, upsertOnboarding,
} from "@/modules/operacoes/fase2.api";
import {
  OP_ONBOARDING_STATUS_LABEL, type OpOnboarding, type OpOnboardingStatus,
} from "@/modules/operacoes/fase2.types";

export const Route = createFileRoute("/operacoes/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Onboarding — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Onboarding">
        <OnboardingPage />
      </AppShell>
    </RequireAuth>
  ),
});

const STATUS_STYLES: Record<OpOnboardingStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  aguardando_cliente: "bg-amber-500/15 text-amber-400",
  em_configuracao: "bg-sky-500/15 text-sky-400",
  concluido: "bg-emerald-500/15 text-emerald-400",
};

function OnboardingPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<OpOnboarding | null>(null);
  const [creating, setCreating] = useState(false);

  const clientesQ = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });
  const onbQ = useQuery({ queryKey: ["op-onboarding"], queryFn: listOnboardings });
  const progQ = useQuery({ queryKey: ["op-onboarding-progress"], queryFn: listOnboardingProgress });

  const progressById = useMemo(() => {
    const m = new Map<string, { done: number; total: number; pct: number }>();
    (progQ.data ?? []).forEach((p) =>
      m.set(p.id, { done: p.steps_done, total: p.steps_total, pct: p.progress }),
    );
    return m;
  }, [progQ.data]);

  const clienteName = (id: string) =>
    clientesQ.data?.find((c) => c.id === id)?.nome ?? "—";

  return (
    <OperacoesLayout description="Centralize redes sociais, credenciais e integrações de cada cliente para começar a operação.">
      <div className="mb-3 flex items-center justify-end">
        <Button onClick={() => setCreating(true)} disabled={!clientesQ.data?.length}>
          <Plus className="mr-2 h-4 w-4" /> Novo onboarding
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Progresso</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Atualizado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {onbQ.isLoading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!onbQ.isLoading && (onbQ.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum onboarding cadastrado.</td></tr>
              )}
              {(onbQ.data ?? []).map((o) => {
                const p = progressById.get(o.id) ?? { done: 0, total: 4, pct: 0 };
                return (
                  <tr key={o.id} className="border-t border-border/60 hover:bg-background/30">
                    <td className="px-3 py-2 font-medium text-foreground">{clienteName(o.client_id)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.company_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-background/60">
                          <div className="h-full bg-primary" style={{ width: `${p.pct}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{p.done} de {p.total}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[o.status]}`}>
                        {OP_ONBOARDING_STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      {new Date(o.updated_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(o)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <OnboardingDialog
        open={creating || !!editing}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
        onboarding={editing}
        clientes={clientesQ.data ?? []}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["op-onboarding"] });
          qc.invalidateQueries({ queryKey: ["op-onboarding-progress"] });
          qc.invalidateQueries({ queryKey: ["op-exec-metrics"] });
        }}
      />
    </OperacoesLayout>
  );
}

function OnboardingDialog({
  open, onOpenChange, onboarding, clientes, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onboarding: OpOnboarding | null;
  clientes: { id: string; nome: string }[];
  onSaved: () => void;
}) {
  const empty = {
    client_id: "",
    company_name: "", cnpj: "", website: "",
    instagram: "", facebook: "", youtube: "",
    meta_ads_connected: false, google_ads_connected: false,
    analytics_connected: false, tag_manager_connected: false,
    goal_type: "",
    status: "pendente" as OpOnboardingStatus,
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (onboarding) {
      setForm({
        client_id: onboarding.client_id,
        company_name: onboarding.company_name ?? "",
        cnpj: onboarding.cnpj ?? "",
        website: onboarding.website ?? "",
        instagram: onboarding.instagram ?? "",
        facebook: onboarding.facebook ?? "",
        youtube: onboarding.youtube ?? "",
        meta_ads_connected: onboarding.meta_ads_connected,
        google_ads_connected: onboarding.google_ads_connected,
        analytics_connected: onboarding.analytics_connected,
        tag_manager_connected: onboarding.tag_manager_connected,
        goal_type: onboarding.goal_type ?? "",
        status: onboarding.status,
      });
    } else if (open) {
      setForm(empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding, open]);

  const m = useMutation({
    mutationFn: () => upsertOnboarding({ ...form, id: onboarding?.id }),
    onSuccess: () => {
      toast.success(onboarding ? "Onboarding atualizado" : "Onboarding criado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checks: Array<[keyof typeof form, string]> = [
    ["meta_ads_connected", "Meta Ads"],
    ["google_ads_connected", "Google Ads"],
    ["analytics_connected", "Analytics"],
    ["tag_manager_connected", "Tag Manager"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{onboarding ? "Editar onboarding" : "Novo onboarding"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Cliente *</label>
            <Select
              value={form.client_id || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
              disabled={!!onboarding}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar cliente…" /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Empresa" v={form.company_name} on={(v) => setForm((f) => ({ ...f, company_name: v }))} />
            <Field label="CNPJ" v={form.cnpj} on={(v) => setForm((f) => ({ ...f, cnpj: v }))} />
            <Field label="Website" v={form.website} on={(v) => setForm((f) => ({ ...f, website: v }))} />
            <Field label="Objetivo" v={form.goal_type} on={(v) => setForm((f) => ({ ...f, goal_type: v }))} />
            <Field label="Instagram" v={form.instagram} on={(v) => setForm((f) => ({ ...f, instagram: v }))} />
            <Field label="Facebook" v={form.facebook} on={(v) => setForm((f) => ({ ...f, facebook: v }))} />
            <Field label="YouTube" v={form.youtube} on={(v) => setForm((f) => ({ ...f, youtube: v }))} />
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as OpOnboardingStatus }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OP_ONBOARDING_STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-background/30 p-3">
            <div className="col-span-2 mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Integrações</div>
            {checks.map(([k, label]) => (
              <label key={String(k)} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[k] as boolean}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.client_id}>
            {m.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}