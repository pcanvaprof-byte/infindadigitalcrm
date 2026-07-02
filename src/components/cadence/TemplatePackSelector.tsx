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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Sparkles, Check } from "lucide-react";

type Pack = {
  pack_key: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  icon: string | null;
  is_system: boolean;
  is_active: boolean;
  template_count: number;
};

const CAT_LABEL: Record<string, string> = {
  geral: "Geral",
  nicho: "Nicho",
  data_especial: "Data especial",
  custom: "Personalizado",
};

const CAT_ORDER = ["geral", "nicho", "data_especial", "custom"];

export function TemplatePackSelector() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [seedPack, setSeedPack] = useState<string>("wa_padrao");
  const DEFAULT_FORM = {
    pack_key: "meu_pack",
    nome: "Meu pack de cadência",
    descricao:
      "Cadência pronta para editar — 13 mensagens humanas e diretas para WhatsApp. Ajuste o tom para o seu nicho.",
    categoria: "custom",
  };
  const [form, setForm] = useState(DEFAULT_FORM);

  async function load() {
    setLoading(true);
    const [{ data, error }, seed] = await Promise.all([
      supabase.rpc("cad_list_packs"),
      supabase.rpc("cad_get_default_seed_pack" as never),
    ]);
    if (error) {
      toast.error(`Falha ao carregar packs: ${error.message}`);
      setPacks([]);
    } else {
      setPacks((data ?? []) as Pack[]);
    }
    const s = (seed as { data?: string | null } | undefined)?.data;
    setSeedPack(s ?? "");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function changeSeed(pack_key: string) {
    setSeedPack(pack_key);
    const { error } = await supabase.rpc("cad_set_default_seed_pack" as never, {
      _pack_key: pack_key,
    } as never);
    if (error) return toast.error(error.message);
    toast.success(
      pack_key
        ? `Novos packs virão semeados com "${pack_key}"`
        : "Novos packs virão vazios",
    );
  }

  async function applyPack(pack_key: string) {
    const { error } = await supabase.rpc("cad_apply_pack", { _pack_key: pack_key });
    if (error) return toast.error(error.message);
    toast.success(`Pack "${pack_key}" ativado`);
    void load();
  }

  async function createPack() {
    const key = form.pack_key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!key || !form.nome.trim()) return toast.error("Chave e nome são obrigatórios");
    const { error } = await supabase.rpc("cad_create_custom_pack", {
      _pack_key: key,
      _nome: form.nome.trim(),
      _descricao: form.descricao.trim() || null,
      _categoria: form.categoria,
      _icon: "Sparkles",
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Pack criado! Agora edite as 13 mensagens em Templates.");
    setDlgOpen(false);
    setForm(DEFAULT_FORM);
    await load();
    await applyPack(key);
  }

  const grouped = CAT_ORDER.map((cat) => ({
    cat,
    items: packs.filter((p) => p.categoria === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="mt-3 surface-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pack de templates da cadência
          </p>
          <p className="text-[11px] text-muted-foreground">
            Escolha o conjunto de 13 mensagens que será usado nos disparos.
            Crie packs para nichos (restaurantes, clínicas…) ou datas
            especiais (dia do dentista, dia do contador…).
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2 py-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Modelo p/ novos packs
            </Label>
            <Select value={seedPack || "__none__"} onValueChange={(v) => changeSeed(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Vazio (sem semear)</SelectItem>
                {packs.map((p) => (
                  <SelectItem key={p.pack_key} value={p.pack_key}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo pack
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo pack de templates</DialogTitle>
              <DialogDescription>
                Crie um conjunto próprio de mensagens para um nicho ou data
                especial. Depois de criar, edite as 13 mensagens na tela de
                Templates.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Dia do Contador"
                />
              </div>
              <div>
                <Label className="text-xs">Chave (sem espaço)</Label>
                <Input
                  value={form.pack_key}
                  onChange={(e) => setForm({ ...form, pack_key: e.target.value })}
                  placeholder="Ex.: dia_contador"
                />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm({ ...form, categoria: v })}
                >
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
                <Textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex.: Cadência para escritórios contábeis com foco em 22/09"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDlgOpen(false)}>Cancelar</Button>
              <Button onClick={createPack}>Criar e ativar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Carregando packs…</p>
      ) : (
        <div className="mt-3 space-y-3">
          {grouped.map((g) => (
            <div key={g.cat}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {CAT_LABEL[g.cat] ?? g.cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((p) => (
                  <button
                    key={p.pack_key}
                    onClick={() => applyPack(p.pack_key)}
                    title={p.descricao ?? undefined}
                    className={`group flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                      p.is_active
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.is_active ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 opacity-60" />
                    )}
                    <span>{p.nome}</span>
                    <span className="text-[10px] opacity-60">· {p.template_count}/13</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}