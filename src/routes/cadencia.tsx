import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, RefreshCw, Download } from "lucide-react";
import { DashboardCadencia } from "@/components/cadencia/DashboardCadencia";
import { CadenciaKanban } from "@/components/cadencia/CadenciaKanban";
import { LeadDrawer } from "@/components/cadencia/LeadDrawer";
import { SendMessageDialog } from "@/components/cadencia/SendMessageDialog";
import { TemplatesPanel } from "@/components/cadencia/TemplatesPanel";
import { listLeads, createLead, importFromProspects, syncLeadStagesFromProspects } from "@/lib/cadencia/api";
import type { CadLead } from "@/lib/cadencia/types";

export const Route = createFileRoute("/cadencia")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cadência — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <CadenciaPage />
    </RequireAuth>
  ),
});

function CadenciaPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dashboard" | "pipeline" | "templates">("dashboard");
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [newL, setNewL] = useState({ empresa: "", responsavel: "", cargo: "", telefone: "", whatsapp: "", email: "" });

  const [drawerLead, setDrawerLead] = useState<CadLead | null>(null);
  const [sendLead, setSendLead] = useState<CadLead | null>(null);

  const leadsQ = useQuery({ queryKey: ["cad-leads"], queryFn: listLeads });
  const leads = useMemo(() => {
    const all = leadsQ.data ?? [];
    if (!search.trim()) return all;
    const s = search.toLowerCase();
    return all.filter((l) =>
      [l.empresa, l.responsavel, l.telefone, l.whatsapp].some((v) => (v || "").toLowerCase().includes(s)),
    );
  }, [leadsQ.data, search]);

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
    onSuccess: ({ imported, updated }) => {
      invalidateAll();
      toast.success(`${imported} importado(s) · ${updated} estágio(s) atualizado(s)`);
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
            <DashboardCadencia />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-4">
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