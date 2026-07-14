import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CatalogItemForm } from "@/components/catalog/CatalogItemForm";
import type { CatalogCategoria, CatalogItem } from "@/lib/catalog/types";
import { getItem, listCategorias, updateItem } from "@/lib/catalog/api";

export const Route = createFileRoute("/catalogo/$id")({
  head: () => ({ meta: [{ title: "Editar item — Catálogo Comercial — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
      <EditarItemPage />
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
});

function EditarItemPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/catalogo/$id" });
  const [categorias, setCategorias] = useState<CatalogCategoria[]>([]);
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listCategorias(), getItem(id)])
      .then(([cats, it]) => {
        setCategorias(cats);
        setItem(it);
        if (!it) toast.error("Item não encontrado");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <AppShell
      title={item ? item.nome_comercial : "Editar item"}
      subtitle={item ? `${item.codigo ?? "sem código"} · ${item.tipo}` : "Carregando…"}
      actions={
        <Button variant="ghost" onClick={() => navigate({ to: "/catalogo" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !item ? (
          <p className="text-sm text-muted-foreground">Item não encontrado.</p>
        ) : (
          <CatalogItemForm
            initial={item}
            categorias={categorias}
            onCancel={() => navigate({ to: "/catalogo" })}
            submitLabel="Salvar alterações"
            onSubmit={async (values) => {
              const updated = await updateItem(item.id, values);
              setItem(updated);
              toast.success("Alterações salvas");
            }}
          />
        )}
      </div>
    </AppShell>
  );
}