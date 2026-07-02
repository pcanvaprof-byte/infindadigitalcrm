import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy } from "lucide-react";

type Item = { stage: string; titulo: string; corpo: string };

const STAGE_LABEL: Record<string, string> = {
  followup_1: "Follow-up 1",
  followup_2: "Follow-up 2",
  followup_3: "Follow-up 3",
  followup_4: "Follow-up 4",
  followup_5: "Follow-up 5",
  followup_6: "Follow-up 6",
  followup_7: "Follow-up 7",
  interessado: "Interessado",
  reuniao_agendada: "Reunião agendada",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

export function DuplicatePackDialog({
  open,
  onOpenChange,
  sourcePackKey,
  sourceNome,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourcePackKey: string | null;
  sourceNome: string | null;
  onCreated: (pack_key: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState({
    pack_key: "",
    nome: "",
    descricao: "",
    categoria: "custom",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !sourcePackKey) return;
    setMeta({
      pack_key: `${sourcePackKey}_copia`,
      nome: `${sourceNome ?? sourcePackKey} (cópia)`,
      descricao: "",
      categoria: "custom",
    });
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("cad_get_pack_templates" as never, {
        _pack_key: sourcePackKey,
      } as never);
      if (error) toast.error(`Falha ao carregar templates: ${error.message}`);
      setItems(((data as Item[] | null) ?? []).map((i) => ({ ...i })));
      setLoading(false);
    })();
  }, [open, sourcePackKey, sourceNome]);

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function save() {
    const key = meta.pack_key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!key || !meta.nome.trim()) return toast.error("Chave e nome são obrigatórios");
    if (items.length === 0) return toast.error("Nenhum template para salvar");
    setSaving(true);
    const { error } = await supabase.rpc("cad_create_pack_with_templates" as never, {
      _pack_key: key,
      _nome: meta.nome.trim(),
      _descricao: meta.descricao.trim(),
      _categoria: meta.categoria,
      _icon: "Copy",
      _items: items,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Pack "${meta.nome}" criado com ${items.length} mensagens`);
    onOpenChange(false);
    onCreated(key);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" /> Duplicar pack "{sourceNome ?? sourcePackKey}"
          </DialogTitle>
          <DialogDescription>
            Ajuste o nome, a chave e edite cada uma das 13 mensagens antes de salvar. Use{" "}
            <code className="rounded bg-muted px-1">{"{{responsavel}}"}</code> e{" "}
            <code className="rounded bg-muted px-1">{"{{empresa}}"}</code> como variáveis.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={meta.nome} onChange={(e) => setMeta({ ...meta, nome: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Chave (sem espaço)</Label>
            <Input
              value={meta.pack_key}
              onChange={(e) => setMeta({ ...meta, pack_key: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={meta.categoria} onValueChange={(v) => setMeta({ ...meta, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nicho">Nicho</SelectItem>
                <SelectItem value="data_especial">Data especial</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              value={meta.descricao}
              onChange={(e) => setMeta({ ...meta, descricao: e.target.value })}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="mt-2 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mensagens ({items.length}/13)
          </p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Carregando…</p>
          ) : (
            items.map((it, i) => (
              <div key={`${it.stage}-${i}`} className="rounded-md border border-border bg-card/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {STAGE_LABEL[it.stage] ?? it.stage}
                  </span>
                </div>
                <Input
                  value={it.titulo}
                  onChange={(e) => updateItem(i, { titulo: e.target.value })}
                  placeholder="Título"
                  className="h-8 text-xs"
                />
                <Textarea
                  value={it.corpo}
                  onChange={(e) => updateItem(i, { corpo: e.target.value })}
                  rows={5}
                  className="text-xs font-mono"
                />
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Salvando…" : "Criar pack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
