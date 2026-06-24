import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listTemplates, upsertTemplate } from "@/lib/cadencia/api";
import { CAD_STAGE_LABEL, type CadStage } from "@/lib/cadencia/types";

export function TemplatesPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cad-templates"], queryFn: listTemplates });
  const [edit, setEdit] = useState<Record<string, { titulo: string; corpo: string }>>({});

  useEffect(() => {
    if (!q.data) return;
    const init: Record<string, { titulo: string; corpo: string }> = {};
    for (const t of q.data) init[t.stage] = { titulo: t.titulo, corpo: t.corpo };
    setEdit(init);
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: (input: { stage: CadStage; titulo: string; corpo: string }) => upsertTemplate(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cad-templates"] }); toast.success("Template salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Carregando templates...</div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Variáveis disponíveis: <code>{`{{empresa}}`}</code>, <code>{`{{responsavel}}`}</code>
      </p>
      {(q.data ?? []).map((t) => {
        const cur = edit[t.stage] ?? { titulo: t.titulo, corpo: t.corpo };
        return (
          <Card key={t.id} className="p-3 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{CAD_STAGE_LABEL[t.stage]}</div>
            <Input value={cur.titulo} onChange={(e) => setEdit((s) => ({ ...s, [t.stage]: { ...cur, titulo: e.target.value } }))} />
            <Textarea rows={6} value={cur.corpo} onChange={(e) => setEdit((s) => ({ ...s, [t.stage]: { ...cur, corpo: e.target.value } }))} />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => saveM.mutate({ stage: t.stage, titulo: cur.titulo, corpo: cur.corpo })}>
                Salvar
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}