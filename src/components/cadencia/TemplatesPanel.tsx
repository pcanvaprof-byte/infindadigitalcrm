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
        Variáveis: <code>{`{{empresa}}`}</code>, <code>{`{{empresa_curta}}`}</code>,{" "}
        <code>{`{{responsavel}}`}</code>, <code>{`{{primeiro_nome}}`}</code>
        <span className="block mt-1 opacity-80">
          Use <code>{`{{empresa_curta}}`}</code> para versões enxutas (remove LTDA/ME/S.A. e mantém até 2 palavras) e{" "}
          <code>{`{{primeiro_nome}}`}</code> para tratar o responsável pelo primeiro nome.
        </span>
        <span className="block mt-1 opacity-80">
          <strong>Rotação anti-bloqueio:</strong> separe variantes com uma linha contendo apenas
          <code> --- </code>. Cadastre 3 ou mais versões por estágio — o sistema revezará entre elas
          a cada disparo para reduzir bloqueios do WhatsApp por padrão repetido.
        </span>
      </p>
      {(q.data ?? []).map((t) => {
        const cur = edit[t.stage] ?? { titulo: t.titulo, corpo: t.corpo };
        const variantCount = (cur.corpo || "").split(/\n\s*---+\s*\n/).map((s) => s.trim()).filter(Boolean).length;
        return (
          <Card key={t.id} className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{CAD_STAGE_LABEL[t.stage]}</div>
              <span
                className={
                  "text-[11px] px-2 py-0.5 rounded-full " +
                  (variantCount >= 3
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-amber-500/15 text-amber-600")
                }
                title="Recomendado: 3 ou mais variantes"
              >
                {variantCount} variante{variantCount === 1 ? "" : "s"}
              </span>
            </div>
            <Input value={cur.titulo} onChange={(e) => setEdit((s) => ({ ...s, [t.stage]: { ...cur, titulo: e.target.value } }))} />
            <Textarea
              rows={8}
              value={cur.corpo}
              onChange={(e) => setEdit((s) => ({ ...s, [t.stage]: { ...cur, corpo: e.target.value } }))}
              placeholder={"Versão A da mensagem\n---\nVersão B da mensagem\n---\nVersão C da mensagem"}
            />
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