import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createApiKey, listApiKeys, revokeApiKey, type ApiKeyRow } from "@/lib/api-keys.functions";

export const Route = createFileRoute("/api-keys")({
  head: () => ({ meta: [{ title: "Chaves de API — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <ApiKeysPage />
    </RequireAuth>
  ),
});

function ApiKeysPage() {
  const qc = useQueryClient();
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);

  const q = useQuery({ queryKey: ["api-keys"], queryFn: () => list() });

  const [name, setName] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: (n: string) => create({ data: { name: n } }),
    onSuccess: (res) => {
      setRevealed(res.full_key);
      setName("");
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Chave revogada.");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const keys: ApiKeyRow[] = useMemo(() => q.data?.keys ?? [], [q.data]);

  return (
    <AppShell title="Chaves de API">
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <KeyRound className="h-6 w-6 text-primary" />
              Chaves de API
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Gere chaves para conectar agentes externos (Claude, n8n, Zapier) ao seu CRM.
              Cada chave é escopada à sua organização ativa e pode ser revogada a qualquer
              momento. Documentação em <code className="rounded bg-muted px-1">/api/public/v1/openapi</code>.
            </p>
          </div>
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova chave
          </Button>
        </header>

        <Card className="p-0">
          {q.isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : keys.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma chave criada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prefixo</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell><code className="text-xs">{k.prefix}…</code></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(k.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      {k.revoked_at
                        ? <Badge variant="destructive">Revogada</Badge>
                        : <Badge variant="secondary">Ativa</Badge>}
                    </TableCell>
                    <TableCell>
                      {!k.revoked_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Revogar a chave "${k.name}"? Aplicações que a usam vão parar de funcionar imediatamente.`)) {
                              revokeMut.mutate(k.id);
                            }
                          }}
                          title="Revogar"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="space-y-3 p-4 text-sm">
          <h2 className="font-semibold">Como usar</h2>
          <p className="text-muted-foreground">
            Envie o header <code className="rounded bg-muted px-1">Authorization: Bearer infd_live_…</code>
            em cada requisição.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{`# Listar clientes
curl -H "Authorization: Bearer infd_live_..." \\
  https://infindadigitalcrm.lovable.app/api/public/v1/clients?limit=10

# Registrar interação
curl -X POST -H "Authorization: Bearer infd_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"type":"ligacao","content":"Ligação de retorno","author":"Claude"}' \\
  https://infindadigitalcrm.lovable.app/api/public/v1/clients/<CLIENT_ID>/interactions

# Tarefas do dia
curl -H "Authorization: Bearer infd_live_..." \\
  https://infindadigitalcrm.lovable.app/api/public/v1/tasks?due=today`}</pre>
          <p className="text-xs text-muted-foreground">
            Endpoints: <code>/me</code>, <code>/clients</code>, <code>/clients/{`{id}`}</code>,{" "}
            <code>/clients/{`{id}`}/interactions</code>, <code>/tasks</code>,{" "}
            <code>/proposals</code>. Spec OpenAPI: <code>/api/public/v1/openapi</code>.
          </p>
        </Card>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova chave de API</DialogTitle>
            <DialogDescription>
              Dê um nome para identificar onde esta chave será usada (ex.: “Claude Desktop”, “n8n produção”).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">Nome</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude — assistente comercial"
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => createMut.mutate(name.trim())}
              disabled={name.trim().length < 2 || createMut.isPending}
            >
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Copie sua chave agora
            </DialogTitle>
            <DialogDescription>
              Este é o único momento em que você verá o valor completo. Guarde em local seguro
              (gerenciador de senhas). Se perder, gere uma nova.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-2">
            <code className="flex-1 overflow-x-auto text-xs">{revealed}</code>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (revealed) navigator.clipboard.writeText(revealed);
                toast.success("Chave copiada.");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>Já copiei, fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}