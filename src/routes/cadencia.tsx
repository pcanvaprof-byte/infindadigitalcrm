import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, RefreshCw, Download, Eraser } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { cleanupOwnerFallback } from "@/lib/prospects/cleanup.functions";
import { DashboardCadencia } from "@/components/cadencia/DashboardCadencia";
import { CadenciaKanban } from "@/components/cadencia/CadenciaKanban";
import { LeadDrawer } from "@/components/cadencia/LeadDrawer";
import { SendMessageDialog } from "@/components/cadencia/SendMessageDialog";
import { TemplatesPanel } from "@/components/cadencia/TemplatesPanel";
import { listLeads, createLead, importFromProspects, syncLeadStagesFromProspects } from "@/lib/cadencia/api";
import type { CadLead, CadStage } from "@/lib/cadencia/types";
import { CAD_STAGE_LABEL } from "@/lib/cadencia/types";
import { leadUf } from "@/lib/cadencia/uf";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export const Route = createFileRoute("/cadencia")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    lead: typeof s.lead === "string" ? s.lead : undefined,
  }),
  head: () => ({ meta: [{ title: "Cadência — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <CadenciaPage />
    </RequireAuth>
  ),
});

function CadenciaPage() {
  const qc = useQueryClient();
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const [tab, setTab] = useState<"dashboard" | "pipeline" | "templates">("dashboard");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<CadStage | null>(null);
  const [ufFilter, setUfFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [newL, setNewL] = useState({ empresa: "", responsavel: "", cargo: "", telefone: "", whatsapp: "", email: "" });

  const [drawerLead, setDrawerLead] = useState<CadLead | null>(null);
  const [sendLead, setSendLead] = useState<CadLead | null>(null);

  const leadsQ = useQuery({ queryKey: ["cad-leads"], queryFn: listLeads });

  // UF real vem de prospects.state. Mapeamos prospect_id → UF (uppercase).
  // Fallback: DDD do telefone/whatsapp via leadUf().
  const prospectIds = useMemo(
    () => Array.from(new Set((leadsQ.data ?? []).map((l) => l.prospect_id).filter((x): x is string => !!x))),
    [leadsQ.data],
  );
  const prospectUfQ = useQuery({
    queryKey: ["cad-prospect-ufs", prospectIds],
    enabled: prospectIds.length > 0,
    queryFn: async () => {
      const map = new Map<string, string>();
      const chunkSize = 500;
      for (let i = 0; i < prospectIds.length; i += chunkSize) {
        const chunk = prospectIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("prospects")
          .select("id,state")
          .in("id", chunk);
        if (error) throw new Error(error.message);
        for (const r of (data ?? []) as Array<{ id: string; state: string | null }>) {
          const uf = (r.state ?? "").trim().toUpperCase();
          if (uf.length === 2) map.set(r.id, uf);
        }
      }
      return map;
    },
  });

  const ufOf = (lead: CadLead): string | null => {
    if (lead.prospect_id) {
      const fromProspect = prospectUfQ.data?.get(lead.prospect_id);
      if (fromProspect) return fromProspect;
    }
    return leadUf(lead);
  };

  // Abre o LeadDrawer automaticamente quando vier via ?lead=<id> (ex.: clique
  // em notificação). Limpa o search param após abrir para evitar reabertura
  // ao fechar o drawer.
  useEffect(() => {
    if (!urlSearch.lead || !leadsQ.data) return;
    const found = leadsQ.data.find((l) => l.id === urlSearch.lead);
    if (found) {
      setDrawerLead(found);
      setTab("pipeline");
      navigate({ search: { lead: undefined } as never, replace: true });
    }
  }, [urlSearch.lead, leadsQ.data, navigate]);

  // Aplica filtros globais (UF + busca) — usado tanto no dashboard quanto no pipeline.
  const leadsScoped = useMemo(() => {
    let all = leadsQ.data ?? [];
    if (ufFilter !== "all") {
      all = all.filter((l) => {
        const uf = ufOf(l);
        return ufFilter === "__none__" ? !uf : uf === ufFilter;
      });
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      all = all.filter((l) =>
        [l.empresa, l.responsavel, l.telefone, l.whatsapp].some((v) => (v || "").toLowerCase().includes(s)),
      );
    }
    return all;
  }, [leadsQ.data, search, ufFilter, prospectUfQ.data]);
  // Pipeline também aplica o filtro de estágio.
  const leads = useMemo(
    () => (stageFilter ? leadsScoped.filter((l) => l.stage === stageFilter) : leadsScoped),
    [leadsScoped, stageFilter],
  );

  // Contagem de leads por UF presente na base (para mostrar no dropdown).
  const ufsDisponiveis = useMemo(() => {
    const counts = new Map<string, number>();
    let semUf = 0;
    for (const l of leadsQ.data ?? []) {
      const uf = ufOf(l);
      if (uf) counts.set(uf, (counts.get(uf) ?? 0) + 1);
      else semUf += 1;
    }
    const ufs = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { ufs, semUf, total: (leadsQ.data ?? []).length };
  }, [leadsQ.data, prospectUfQ.data]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["cad-leads"] });
    qc.invalidateQueries({ queryKey: ["cad-metrics"] });
  };

  const createM = useMutation({
    mutationFn: () => createLead({ ...newL, empresa: newL.empresa.trim() }),
    onSuccess: () => {
      invalidateAll();
      setOpenNew(false);
      setNewL({ empresa: "", responsavel: "", cargo: "", telefone: "", whatsapp: "", email: "" });
      toast.success("Lead criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importM = useMutation({
    mutationFn: importFromProspects,
    onSuccess: ({ imported, updated, skipped, cleaned }) => {
      invalidateAll();
      toast.success(
        `${imported} importado(s) · ${updated} estágio(s) atualizado(s) · ${skipped} não contatado(s) permanecem em Prospecção${cleaned ? ` · ${cleaned} card(s) sem disparo removido(s)` : ""}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshM = useMutation({
    mutationFn: syncLeadStagesFromProspects,
    onSuccess: (updated) => {
      invalidateAll();
      toast.success(updated > 0 ? `${updated} estágio(s) atualizado(s)` : "Dashboard atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cleanupFn = useServerFn(cleanupOwnerFallback);
  const cleanupM = useMutation({
    mutationFn: () => cleanupFn(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["cad-leads"] });
      toast.success(
        r.cleared > 0
          ? `${r.cleared} responsável(is) limpo(s)`
          : "Nenhum responsável precisava ser limpo",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Cadência Comercial">
      <div className="p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <h1 className="text-xl font-semibold text-foreground">Cadência</h1>
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
            <Input
              placeholder="Buscar empresa, responsável..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados ({ufsDisponiveis.total})</SelectItem>
                {ufsDisponiveis.ufs.map(([uf, n]) => (
                  <SelectItem key={uf} value={uf}>{uf} ({n})</SelectItem>
                ))}
                {ufsDisponiveis.semUf > 0 && (
                  <SelectItem value="__none__">Sem UF ({ufsDisponiveis.semUf})</SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
              <Button variant="outline" size="sm" onClick={() => importM.mutate()} disabled={importM.isPending} className="w-full sm:w-auto">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Importar de Prospecção</span>
                <span className="ml-1 sm:hidden">Importar</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => refreshM.mutate()} disabled={refreshM.isPending} className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="ml-1 sm:ml-0">Atualizar</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => cleanupM.mutate()} disabled={cleanupM.isPending} className="w-full sm:w-auto" title="Limpa o responsável dos prospects que receberam o seu nome automaticamente">
                <Eraser className="h-4 w-4 sm:mr-2" />
                <span className="ml-1 sm:ml-0">Limpar responsáveis</span>
              </Button>
              <Button size="sm" onClick={() => setOpenNew(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="ml-1 sm:ml-0">Novo lead</span>
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <DashboardCadencia
              onStageSelect={(s) => {
                setStageFilter(s);
                setTab("pipeline");
              }}
              filteredLeads={ufFilter !== "all" || search.trim() ? leads : undefined}
              filterLabel={
                ufFilter === "all" && !search.trim()
                  ? null
                  : [
                      ufFilter === "__none__"
                        ? "Sem UF"
                        : ufFilter !== "all"
                          ? `Estado ${ufFilter}`
                          : null,
                      search.trim() ? `Busca "${search.trim()}"` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
              }
            />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-4">
            {stageFilter && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                <span className="text-foreground">
                  Filtrando por etapa: <strong>{CAD_STAGE_LABEL[stageFilter]}</strong> · {leads.length} lead(s)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7"
                  onClick={() => setStageFilter(null)}
                >
                  <X className="h-3 w-3 mr-1" /> Limpar filtro
                </Button>
              </div>
            )}
            {leadsQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : leads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum lead em cadência. Use "Importar de Prospecção" ou "Novo lead".
              </div>
            ) : (
              <CadenciaKanban
                leads={leads}
                onOpen={setDrawerLead}
                onSend={setSendLead}
              />
            )}
          </TabsContent>
          <TabsContent value="templates" className="mt-4">
            <TemplatesPanel />
          </TabsContent>
        </Tabs>

        <LeadDrawer
          lead={drawerLead}
          open={!!drawerLead}
          onOpenChange={(o) => !o && setDrawerLead(null)}
          onSend={() => { if (drawerLead) setSendLead(drawerLead); }}
        />
        <SendMessageDialog
          lead={sendLead}
          open={!!sendLead}
          onOpenChange={(o) => !o && setSendLead(null)}
        />

        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Input placeholder="Empresa *" value={newL.empresa} onChange={(e) => setNewL({ ...newL, empresa: e.target.value })} />
              <Input placeholder="Responsável" value={newL.responsavel} onChange={(e) => setNewL({ ...newL, responsavel: e.target.value })} />
              <Input placeholder="Cargo" value={newL.cargo} onChange={(e) => setNewL({ ...newL, cargo: e.target.value })} />
              <Input placeholder="Telefone" value={newL.telefone} onChange={(e) => setNewL({ ...newL, telefone: e.target.value })} />
              <Input placeholder="WhatsApp" value={newL.whatsapp} onChange={(e) => setNewL({ ...newL, whatsapp: e.target.value })} />
              <Input placeholder="Email" value={newL.email} onChange={(e) => setNewL({ ...newL, email: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
              <Button onClick={() => createM.mutate()} disabled={!newL.empresa.trim() || createM.isPending}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}