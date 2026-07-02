import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Sparkles, Check, Copy } from "lucide-react";
import { DuplicatePackDialog } from "./DuplicatePackDialog";

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
  const [dupSource, setDupSource] = useState<{ key: string; nome: string } | null>(null);
  const [seedPack, setSeedPack] = useState<string>("wa_padrao");

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
    // Também ativa o pack selecionado — assim já vai configurado no clique de WhatsApp.
    if (pack_key) {
      const { error: e2 } = await supabase.rpc("cad_apply_pack", { _pack_key: pack_key });
      if (e2) return toast.error(e2.message);
      toast.success(`Pack "${pack_key}" ativado e definido como modelo`);
      void load();
    } else {
      toast.success("Novos packs virão vazios");
    }
  }

  async function applyPack(pack_key: string) {
    const { error } = await supabase.rpc("cad_apply_pack", { _pack_key: pack_key });
    if (error) return toast.error(error.message);
    toast.success(`Pack "${pack_key}" ativado`);
    void load();
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
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => {
            const src = packs.find((p) => p.pack_key === (seedPack || "wa_padrao"))
              ?? packs.find((p) => p.pack_key === "wa_padrao")
              ?? packs[0];
            if (!src) return toast.error("Nenhum pack disponível para servir de modelo");
            setDupSource({ key: src.pack_key, nome: src.nome });
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo pack
        </Button>
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
                  <div
                    key={p.pack_key}
                    className={`group flex items-center gap-0.5 rounded-full border text-xs transition ${
                      p.is_active
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <button
                      onClick={() => applyPack(p.pack_key)}
                      title={p.descricao ?? undefined}
                      className="flex items-center gap-1.5 pl-3 pr-1 py-1"
                    >
                      {p.is_active ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 opacity-60" />
                      )}
                      <span>{p.nome}</span>
                      <span className="text-[10px] opacity-60">· {p.template_count}/13</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDupSource({ key: p.pack_key, nome: p.nome }); }}
                      title={`Duplicar "${p.nome}" e editar as 13 mensagens`}
                      className="flex items-center justify-center rounded-full p-1 pr-2 opacity-60 hover:opacity-100"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <DuplicatePackDialog
        open={!!dupSource}
        onOpenChange={(v) => !v && setDupSource(null)}
        sourcePackKey={dupSource?.key ?? null}
        sourceNome={dupSource?.nome ?? null}
        onCreated={(key) => { void load(); void applyPack(key); }}
      />
    </section>
  );
}