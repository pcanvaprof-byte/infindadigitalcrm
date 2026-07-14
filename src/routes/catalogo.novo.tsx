import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CatalogItemForm } from "@/components/catalog/CatalogItemForm";
import type { CatalogCategoria } from "@/lib/catalog/types";
import { createItem, listCategorias } from "@/lib/catalog/api";

export const Route = createFileRoute("/catalogo/novo")({
  head: () => ({ meta: [{ title: "Novo item — Catálogo Comercial — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
      <NovoItemPage />
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
});

function NovoItemPage() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<CatalogCategoria[]>([]);

  useEffect(() => {
    listCategorias()
      .then(setCategorias)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar categorias"));
  }, []);

  return (
    <AppShell
      title="Novo item do catálogo"
      subtitle="Cadastre um serviço, pacote, complemento ou bônus."
      actions={
        <Button variant="ghost" onClick={() => navigate({ to: "/catalogo" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl">
        <CatalogItemForm
          categorias={categorias}
          onCancel={() => navigate({ to: "/catalogo" })}
          submitLabel="Criar item"
          onSubmit={async (values) => {
            const created = await createItem(values);
            toast.success("Item criado");
            navigate({ to: "/catalogo/$id", params: { id: created.id } });
          }}
        />
      </div>
    </AppShell>
  );
}