import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  Edit,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Power,
} from "lucide-react";
import {
  AREA_LABEL,
  AREA_OPTIONS,
  COBRANCA_LABEL,
  TIPO_ICON,
  TIPO_LABEL,
  TIPO_OPTIONS,
  formatBRL,
  precoExibido,
  type CatalogArea,
  type CatalogCategoria,
  type CatalogItem,
  type CatalogTipo,
} from "@/lib/catalog/types";
import {
  computeStats,
  deleteItem,
  duplicateItem,
  listCategorias,
  listItems,
  toggleAtivo,
} from "@/lib/catalog/api";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo Comercial — INFINDA" },
      { name: "description", content: "Serviços, pacotes, complementos e bônus da INFINDA." },
    ],
  }),
  component: CatalogoRoute,
});

function CatalogoRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <RequireAuth>
      <RequireOwnerOrAdmin>
        {pathname === "/catalogo" ? <CatalogoPage /> : <Outlet />}
      </RequireOwnerOrAdmin>
    </RequireAuth>
  );
}

function CatalogoPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categorias, setCategorias] = useState<CatalogCategoria[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [search, setSearch] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("all");
  const [tipo, setTipo] = useState<string>("all");
  const [area, setArea] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "ativos" | "inativos">("all");

  // delete dialog
  const [toDelete, setToDelete] = useState<CatalogItem | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [cats, list] = await Promise.all([listCategorias(), listItems({})]);
      setCategorias(cats);
      setItems(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar catálogo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (categoriaId !== "all" && i.categoria_id !== categoriaId) return false;
      if (tipo !== "all" && i.tipo !== tipo) return false;
      if (area !== "all" && i.area_responsavel !== area) return false;
      if (status === "ativos" && !i.ativo) return false;
      if (status === "inativos" && i.ativo) return false;
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const hay = [
          i.nome_comercial,
          i.nome_interno ?? "",
          i.codigo ?? "",
          i.objetivo ?? "",
          ...(i.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, categoriaId, tipo, area, status, search]);

  const stats = useMemo(() => computeStats(items, categorias), [items, categorias]);

  const categoriaMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categorias) m.set(c.id, c.nome);
    return m;
  }, [categorias]);

  async function handleToggle(item: CatalogItem) {
    try {
      await toggleAtivo(item.id, !item.ativo);
      toast.success(item.ativo ? "Item desativado" : "Item ativado");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao alterar status");
    }
  }

  async function handleDuplicate(item: CatalogItem) {
    try {
      const copy = await duplicateItem(item.id);
      toast.success("Item duplicado");
      navigate({ to: "/catalogo/$id", params: { id: copy.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao duplicar");
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await deleteItem(toDelete.id);
      toast.success("Item excluído");
      setToDelete(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  return (
    <AppShell
      title="Catálogo Comercial"
      subtitle="Serviços, pacotes, complementos e bônus reutilizados em propostas, projetos e financeiro."
      actions={
        <Button asChild>
          <Link to="/catalogo/novo">
            <Plus className="mr-2 h-4 w-4" /> Novo item
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Coluna principal */}
        <div className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome, código, objetivo ou tag…"
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {TIPO_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_ICON[t]} {TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas áreas</SelectItem>
                  {AREA_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{AREA_LABEL[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="md:col-span-1"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="ativos">Apenas ativos</SelectItem>
                  <SelectItem value="inativos">Apenas inativos</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Cobrança</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Carregando catálogo…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Nenhum item encontrado. Clique em <strong>Novo item</strong> para cadastrar o primeiro.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filtered.map((i) => (
                    <TableRow key={i.id} className="cursor-pointer" onClick={() => navigate({ to: "/catalogo/$id", params: { id: i.id } })}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {TIPO_ICON[i.tipo]} {i.nome_comercial}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {i.codigo ? `${i.codigo} · ` : ""}
                            {TIPO_LABEL[i.tipo]}
                            {i.objetivo ? ` · ${i.objetivo}` : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {i.categoria_id ? categoriaMap.get(i.categoria_id) ?? "—" : "—"}
                        {i.subcategoria && (
                          <span className="block text-xs text-muted-foreground">{i.subcategoria}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{AREA_LABEL[i.area_responsavel]}</TableCell>
                      <TableCell className="text-sm">{COBRANCA_LABEL[i.cobranca]}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {precoExibido(i)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={i.ativo ? "default" : "secondary"}>
                          {i.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate({ to: "/catalogo/$id", params: { id: i.id } })}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(i)}>
                              <Copy className="mr-2 h-4 w-4" /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggle(i)}>
                              <Power className="mr-2 h-4 w-4" />
                              {i.ativo ? "Desativar" : "Ativar"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setToDelete(i)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar de estatísticas */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                Visão geral
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Stat label="Total" value={stats.total} />
              <Stat label="Categorias" value={stats.categorias} />
              <Stat label="Ativos" value={stats.ativos} accent="success" />
              <Stat label="Inativos" value={stats.inativos} accent="muted" />
              <div className="col-span-2 rounded-lg border border-border bg-card/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ticket médio</p>
                <p className="mt-1 text-lg font-semibold">{formatBRL(stats.ticketMedio)}</p>
                <p className="text-[11px] text-muted-foreground">Média dos itens ativos.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                Por tipo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {TIPO_OPTIONS.map((t) => (
                <div key={t} className="flex items-center justify-between text-sm">
                  <span>{TIPO_ICON[t]} {TIPO_LABEL[t]}</span>
                  <Badge variant="secondary">{stats.porTipo[t] ?? 0}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                Importação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Em breve: importação de planilha CSV/Excel para popular o catálogo em lote.
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full" disabled>
                Importar planilha
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item do catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. <strong>{toDelete?.nome_comercial}</strong> será removido do catálogo.
              Se este item já estiver em propostas, prefira <em>desativar</em> em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "success" | "muted" }) {
  const color =
    accent === "success" ? "text-emerald-400" : accent === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}