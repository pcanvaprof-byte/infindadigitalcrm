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

  async function getActiveOrgId() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const userId = userData.user?.id;
    if (!userId) throw new Error("Usuário não autenticado");

    const { data: activeOrg } = await supabase
      .from("user_active_org")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    let orgId = activeOrg?.organization_id ?? null;
    if (!orgId) {
      const { data: membership, error: memberError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (memberError) throw memberError;
      orgId = membership?.organization_id ?? null;
    }

    if (!orgId) throw new Error("Organização ativa não encontrada");
    return orgId;
  }

  async function loadFromTables() {
    const orgId = await getActiveOrgId();

    const [{ data: org, error: orgError }, { data: rows, error: packsError }, { data: templates, error: templatesError }] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("active_template_pack, default_seed_pack")
          .eq("id", orgId)
          .maybeSingle(),
        supabase
          .from("cad_template_packs")
          .select("pack_key,nome,descricao,categoria,icon,is_system,organization_id")
          .or(`is_system.eq.true,organization_id.eq.${orgId}`),
        supabase
          .from("cad_templates")
          .select("pack_key,is_system,organization_id")
          .or(`is_system.eq.true,organization_id.eq.${orgId}`),
      ]);

    if (orgError) throw orgError;
    if (packsError) throw packsError;
    if (templatesError) throw templatesError;

    const counts = new Map<string, number>();
    for (const item of templates ?? []) {
      counts.set(item.pack_key, (counts.get(item.pack_key) ?? 0) + 1);
    }

    const activeKey = org?.active_template_pack ?? "default";
    const loaded = ((rows ?? []) as Array<Omit<Pack, "is_active" | "template_count"> & { organization_id: string | null }>).map((p) => ({
      pack_key: p.pack_key,
      nome: p.nome,
      descricao: p.descricao,
      categoria: p.categoria,
      icon: p.icon,
      is_system: p.is_system,
      is_active: p.pack_key === activeKey,
      template_count: counts.get(p.pack_key) ?? 0,
    }));

    loaded.sort((a, b) => {
      if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
      const cat = CAT_ORDER.indexOf(a.categoria) - CAT_ORDER.indexOf(b.categoria);
      return cat || a.nome.localeCompare(b.nome, "pt-BR");
    });

    return { packs: loaded, seedPack: org?.default_seed_pack ?? "" };
  }

  async function load() {
    setLoading(true);
    try {
      const result = await loadFromTables();
      setPacks(result.packs);
      setSeedPack(result.seedPack);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao carregar packs: ${message}`);
      setPacks([]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function changeSeed(pack_key: string) {
    setSeedPack(pack_key);
    try {
      const orgId = await getActiveOrgId();
      const patch = pack_key
        ? { default_seed_pack: pack_key, active_template_pack: pack_key }
        : { default_seed_pack: null };
      const { error } = await supabase.from("organizations").update(patch).eq("id", orgId);
      if (error) throw error;
      if (pack_key) {
        toast.success(`Pack "${pack_key}" ativado e definido como modelo`);
      } else {
        toast.success("Novos packs virão vazios");
      }
      void load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar modelo";
      toast.error(message);
    }
  }

  async function applyPack(pack_key: string) {
    try {
      const orgId = await getActiveOrgId();
      const { error } = await supabase
        .from("organizations")
        .update({ active_template_pack: pack_key })
        .eq("id", orgId);
      if (error) throw error;
      toast.success(`Pack "${pack_key}" ativado e definido como modelo`);
      void load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao ativar pack";
      toast.error(message);
    }
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