import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Check, Copy, Star, Trash2, Pencil, Search, Wand2, Eye, Plus, X,
} from "lucide-react";
import { adaptarPackComIA } from "@/lib/cadence/adapt-ai.functions";
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
  is_favorite: boolean;
  objetivo: string | null;
  segmento: string | null;
  tags: string[] | null;
};

type Item = { stage: string; titulo: string; corpo: string };

const CAT_LABEL: Record<string, string> = {
  geral: "Geral",
  nicho: "Nicho",
  utilitario: "Utilitários (Reativação, Follow-up, Pós-venda)",
  data_especial: "Datas comemorativas",
  custom: "Personalizados",
  saude: "Saúde",
  odontologia: "Odontologia",
  contabilidade: "Contabilidade",
  advocacia: "Advocacia",
  imobiliaria: "Imobiliárias",
  academia: "Academias",
  loja_infantil: "Loja Infantil",
  loja_roupas: "Loja de Roupas",
  auto_center: "Auto Center",
  concessionaria: "Concessionárias",
  b2b: "B2B",
  restaurante: "Restaurantes & Delivery",
  estetica: "Estética",
  barbearia: "Barbearia",
  salao_beleza: "Salão de Beleza",
  educacao: "Educação",
  turismo: "Turismo",
  petshop: "Pet & Vet",
  marketing: "Marketing",
  tecnologia: "Tecnologia",
  engenharia: "Engenharia",
  arquitetura: "Arquitetura",
  seguros: "Seguros",
  financeiro: "Financeiro",
  energia_solar: "Energia Solar",
  moveis_planejados: "Móveis Planejados",
  eventos: "Eventos",
};

// Ordem estável de exibição das categorias na listagem (grupos > alfabético).
const CAT_ORDER: string[] = [
  "custom",
  "utilitario",
  "data_especial",
  "geral",
  "nicho",
  "saude", "odontologia", "estetica", "salao_beleza", "barbearia", "petshop",
  "restaurante", "loja_infantil", "loja_roupas", "auto_center", "concessionaria",
  "academia", "educacao", "turismo", "eventos",
  "contabilidade", "advocacia", "imobiliaria", "seguros", "financeiro",
  "b2b", "marketing", "tecnologia", "engenharia", "arquitetura",
  "energia_solar", "moveis_planejados",
];
function catRank(c: string) {
  const i = CAT_ORDER.indexOf(c);
  return i === -1 ? 999 : i;
}

const STAGE_LABEL: Record<string, string> = {
  followup_1: "Follow-up 1 (dia 0)", followup_2: "Follow-up 2 (+3d)",
  followup_3: "Follow-up 3 (+7d)", followup_4: "Follow-up 4 (+10d)",
  followup_5: "Follow-up 5 (+14d)", followup_6: "Follow-up 6 (+18d)",
  followup_7: "Follow-up 7 (+24d)",
  interessado: "Interessado", reuniao_agendada: "Reunião agendada",
  proposta_enviada: "Proposta enviada", negociacao: "Negociação",
  fechado: "Fechado", perdido: "Perdido",
};

const STAGES = Object.keys(STAGE_LABEL);
const VARIABLES = ["responsavel", "empresa", "cidade", "segmento", "telefone", "cargo"];

async function getActiveOrgId(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Usuário não autenticado");
  const { data: a } = await supabase.from("user_active_org").select("organization_id").eq("user_id", uid).maybeSingle();
  let orgId = a?.organization_id ?? null;
  if (!orgId) {
    const { data: m } = await supabase.from("organization_members").select("organization_id").eq("user_id", uid).limit(1).maybeSingle();
    orgId = m?.organization_id ?? null;
  }
  if (!orgId) throw new Error("Organização ativa não encontrada");
  return orgId;
}

export function TemplateLibrary() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [onlyFav, setOnlyFav] = useState(false);
  const [selected, setSelected] = useState<Pack | null>(null);
  const [previewItems, setPreviewItems] = useState<Item[]>([]);
  const [dupSource, setDupSource] = useState<{ key: string; nome: string } | null>(null);
  const [editing, setEditing] = useState<Pack | null>(null);
  const [aiOpen, setAiOpen] = useState<Pack | null>(null);

  const adaptFn = useServerFn(adaptarPackComIA);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("cad_list_packs");
      if (error) throw error;
      setPacks((data ?? []) as Pack[]);
    } catch (e) {
      toast.error(`Falha ao carregar biblioteca: ${(e as Error).message}`);
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function loadPreview(pack: Pack) {
    setSelected(pack);
    setPreviewItems([]);
    const { data, error } = await supabase.rpc("cad_get_pack_templates", { _pack_key: pack.pack_key });
    if (error) return toast.error(error.message);
    setPreviewItems(((data ?? []) as Item[]));
  }

  async function applyPack(p: Pack) {
    try {
      const orgId = await getActiveOrgId();
      const { error } = await supabase.from("organizations")
        .update({ active_template_pack: p.pack_key }).eq("id", orgId);
      if (error) throw error;
      toast.success(`Pack "${p.nome}" ativado`);
      void load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function toggleFav(p: Pack) {
    const { error } = await supabase.rpc("cad_toggle_favorite", { _pack_key: p.pack_key });
    if (error) return toast.error(error.message);
    setPacks((prev) => prev.map((x) => x.pack_key === p.pack_key ? { ...x, is_favorite: !x.is_favorite } : x));
  }

  async function deletePack(p: Pack) {
    if (p.is_system) return toast.error("Packs oficiais não podem ser excluídos — duplique para editar");
    if (!confirm(`Excluir o pack "${p.nome}"?`)) return;
    const { error } = await supabase.rpc("cad_delete_pack", { _pack_key: p.pack_key });
    if (error) return toast.error(error.message);
    toast.success("Pack excluído");
    setSelected(null);
    void load();
  }

  const categorias = useMemo(() => {
    const cats = Array.from(new Set(packs.map((p) => p.categoria)));
    cats.sort();
    return cats;
  }, [packs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return packs.filter((p) => {
      if (onlyFav && !p.is_favorite) return false;
      if (catFilter !== "all" && p.categoria !== catFilter) return false;
      if (!needle) return true;
      const hay = [p.nome, p.descricao, p.categoria, p.segmento, ...(p.tags ?? [])]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [packs, q, catFilter, onlyFav]);

  const grouped = useMemo(() => {
    const map = new Map<string, Pack[]>();
    filtered.forEach((p) => {
      const arr = map.get(p.categoria) ?? [];
      arr.push(p);
      map.set(p.categoria, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const ra = catRank(a[0]);
      const rb = catRank(b[0]);
      if (ra !== rb) return ra - rb;
      return (CAT_LABEL[a[0]] ?? a[0]).localeCompare(CAT_LABEL[b[0]] ?? b[0]);
    });
  }, [filtered]);

  return (
    <section className="mt-3 surface-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Biblioteca de cadências
          </p>
          <p className="text-[11px] text-muted-foreground">
            {packs.length} packs · {packs.filter((p) => p.is_favorite).length} favoritos · pack ativo: <b>{packs.find((p) => p.is_active)?.nome ?? "—"}</b>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, tag, segmento…"
              className="h-8 w-[220px] pl-7 text-xs" />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>{CAT_LABEL[c] ?? c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={onlyFav ? "default" : "outline"} size="sm" className="h-8 text-xs"
            onClick={() => setOnlyFav((v) => !v)}>
            <Star className={`mr-1 h-3.5 w-3.5 ${onlyFav ? "fill-current" : ""}`} /> Favoritos
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs"
            onClick={() => {
              const src = packs.find((p) => p.pack_key === "wa_padrao") ?? packs[0];
              if (src) setDupSource({ key: src.pack_key, nome: src.nome });
            }}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Novo pack
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando biblioteca…</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <ScrollArea className="max-h-[520px] pr-2">
            <div className="space-y-4">
              {grouped.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum pack encontrado.</p>
              )}
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {CAT_LABEL[cat] ?? cat} · {items.length}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((p) => (
                      <div key={p.pack_key}
                        onClick={() => void loadPreview(p)}
                        className={`group cursor-pointer rounded-lg border p-2.5 text-xs transition ${
                          selected?.pack_key === p.pack_key ? "border-primary bg-primary/5"
                          : p.is_active ? "border-emerald-500/50 bg-emerald-500/5"
                          : "border-border bg-card/60 hover:border-border/80"
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {p.is_active && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
                              <span className="truncate font-medium">{p.nome}</span>
                            </div>
                            {p.descricao && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{p.descricao}</p>}
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {p.is_system && <Badge variant="secondary" className="h-4 px-1 text-[9px]">oficial</Badge>}
                              {p.segmento && <Badge variant="outline" className="h-4 px-1 text-[9px]">{p.segmento}</Badge>}
                              <Badge variant="outline" className="h-4 px-1 text-[9px]">{p.template_count}/13</Badge>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); void toggleFav(p); }}
                            className="shrink-0 p-1 opacity-60 hover:opacity-100"
                            title="Favoritar">
                            <Star className={`h-3.5 w-3.5 ${p.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Preview panel */}
          <div className="rounded-lg border border-border bg-card/40 p-3">
            {!selected ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-1 text-center">
                <Eye className="h-6 w-6 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Selecione um pack para pré-visualizar</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selected.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {CAT_LABEL[selected.categoria] ?? selected.categoria}
                      {selected.segmento && ` · ${selected.segmento}`}
                    </p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 opacity-60 hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {selected.objetivo && <p className="rounded bg-muted/40 px-2 py-1 text-[11px]">🎯 {selected.objetivo}</p>}
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" className="h-7 text-xs" onClick={() => void applyPack(selected)} disabled={selected.is_active}>
                    {selected.is_active ? "Ativo" : "Ativar pack"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setDupSource({ key: selected.pack_key, nome: selected.nome })}>
                    <Copy className="mr-1 h-3 w-3" /> Duplicar
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAiOpen(selected)}>
                    <Wand2 className="mr-1 h-3 w-3" /> Adaptar IA
                  </Button>
                  {!selected.is_system && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(selected)}>
                        <Pencil className="mr-1 h-3 w-3" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => void deletePack(selected)}>
                        <Trash2 className="mr-1 h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                <Separator />
                <ScrollArea className="max-h-[380px] pr-2">
                  <div className="space-y-2">
                    {previewItems.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Carregando mensagens…</p>
                    ) : previewItems.map((it) => (
                      <div key={it.stage} className="rounded border border-border/50 bg-background/40 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {STAGE_LABEL[it.stage] ?? it.stage}
                        </p>
                        <p className="text-[11px] font-medium">{it.titulo}</p>
                        <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{it.corpo}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      )}

      <DuplicatePackDialog
        open={!!dupSource}
        onOpenChange={(v) => !v && setDupSource(null)}
        sourcePackKey={dupSource?.key ?? null}
        sourceNome={dupSource?.nome ?? null}
        onCreated={(key) => { void load(); void applyPack({ pack_key: key } as Pack); }}
      />

      {editing && (
        <EditPackDialog pack={editing} onClose={() => setEditing(null)} onSaved={() => { void load(); if (selected?.pack_key === editing.pack_key) void loadPreview(editing); }} />
      )}

      {aiOpen && (
        <AdaptWithAIDialog
          pack={aiOpen}
          onClose={() => setAiOpen(null)}
          onDone={async (key) => {
            setAiOpen(null);
            await load();
            const p = { pack_key: key } as Pack;
            await applyPack(p);
          }}
          adaptFn={adaptFn}
        />
      )}
    </section>
  );
}

/* ================= Edit dialog ================= */

function EditPackDialog({ pack, onClose, onSaved }: {
  pack: Pack; onClose: () => void; onSaved: () => void;
}) {
  const [meta, setMeta] = useState({
    nome: pack.nome, descricao: pack.descricao ?? "", categoria: pack.categoria,
    objetivo: pack.objetivo ?? "", segmento: pack.segmento ?? "",
    tags: (pack.tags ?? []).join(", "),
  });
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStage, setActiveStage] = useState<string>(STAGES[0]);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("cad_get_pack_templates", { _pack_key: pack.pack_key });
      if (error) toast.error(error.message);
      const loaded = ((data ?? []) as Item[]);
      // ensure all 13 stages exist
      const byStage = new Map(loaded.map((i) => [i.stage, i]));
      const full = STAGES.map((s) => byStage.get(s) ?? { stage: s, titulo: "", corpo: "" });
      setItems(full);
      setLoading(false);
    })();
  }, [pack.pack_key]);

  const current = items.find((i) => i.stage === activeStage);

  function updateCurrent(patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => i.stage === activeStage ? { ...i, ...patch } : i));
  }

  function insertVar(v: string) {
    if (!current) return;
    const tag = `{{${v}}}`;
    updateCurrent({ corpo: (current.corpo ?? "") + tag });
  }

  async function save() {
    setSaving(true);
    try {
      const tags = meta.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { error: mErr } = await supabase.rpc("cad_update_pack_meta", {
        _pack_key: pack.pack_key,
        _nome: meta.nome, _descricao: meta.descricao, _categoria: meta.categoria,
        _icon: pack.icon ?? "Sparkles", _objetivo: meta.objetivo, _segmento: meta.segmento,
        _tags: tags,
      });
      if (mErr) throw mErr;
      for (const it of items) {
        if (!it.titulo && !it.corpo) continue;
        const { error } = await supabase.rpc("cad_upsert_template", {
          _pack_key: pack.pack_key, _stage: it.stage as never,
          _titulo: it.titulo, _corpo: it.corpo,
        });
        if (error) throw error;
      }
      toast.success("Pack salvo");
      onSaved(); onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Editar pack — {pack.nome}</DialogTitle>
          <DialogDescription>Edite metadados e as 13 mensagens da cadência.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div><Label className="text-xs">Nome</Label><Input value={meta.nome} onChange={(e) => setMeta({ ...meta, nome: e.target.value })} /></div>
            <div><Label className="text-xs">Descrição</Label><Input value={meta.descricao} onChange={(e) => setMeta({ ...meta, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Categoria</Label><Input value={meta.categoria} onChange={(e) => setMeta({ ...meta, categoria: e.target.value })} /></div>
              <div><Label className="text-xs">Segmento</Label><Input value={meta.segmento} onChange={(e) => setMeta({ ...meta, segmento: e.target.value })} /></div>
            </div>
          </div>
          <div className="space-y-2">
            <div><Label className="text-xs">Objetivo</Label><Input value={meta.objetivo} onChange={(e) => setMeta({ ...meta, objetivo: e.target.value })} /></div>
            <div><Label className="text-xs">Tags (separadas por vírgula)</Label><Input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} /></div>
          </div>
        </div>
        <Separator />
        {loading ? <p className="text-xs text-muted-foreground">Carregando…</p> : (
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <ScrollArea className="max-h-[360px]">
              <div className="space-y-1">
                {items.map((it) => (
                  <button key={it.stage} onClick={() => setActiveStage(it.stage)}
                    className={`w-full rounded border px-2 py-1.5 text-left text-[11px] ${
                      activeStage === it.stage ? "border-primary bg-primary/5" : "border-border/50"
                    }`}>
                    <p className="font-medium">{STAGE_LABEL[it.stage] ?? it.stage}</p>
                    <p className="line-clamp-1 text-muted-foreground">{it.titulo || <span className="italic opacity-60">(sem título)</span>}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
            {current && (
              <div className="space-y-2">
                <div><Label className="text-xs">Título da etapa</Label>
                  <Input value={current.titulo} onChange={(e) => updateCurrent({ titulo: e.target.value })} /></div>
                <div><Label className="text-xs">Mensagem</Label>
                  <Textarea value={current.corpo} onChange={(e) => updateCurrent({ corpo: e.target.value })} rows={10} /></div>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Variáveis:</span>
                  {VARIABLES.map((v) => (
                    <button key={v} type="button" onClick={() => insertVar(v)}
                      className="rounded border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Delays de follow-up são definidos pelo motor (3/7/10/14/18/24/30 dias). Só a mensagem é editável.
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Adapt with AI dialog ================= */

function AdaptWithAIDialog({ pack, onClose, onDone, adaptFn }: {
  pack: Pack;
  onClose: () => void;
  onDone: (key: string) => void | Promise<void>;
  adaptFn: (opts: { data: { source_pack_key: string; new_pack_key: string; nome: string; segmento: string; categoria: string; descricao: string } }) => Promise<{ pack_key: string; count: number }>;
}) {
  const [segmento, setSegmento] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!segmento.trim()) return toast.error("Informe o segmento");
    setLoading(true);
    try {
      const slug = segmento.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
      const key = `ia_${slug}_${Date.now().toString(36).slice(-4)}`;
      const finalNome = nome.trim() || `${pack.nome} · ${segmento}`;
      const res = await adaptFn({ data: {
        source_pack_key: pack.pack_key,
        new_pack_key: key,
        nome: finalNome, segmento: segmento.trim(),
        categoria: "custom",
        descricao: `Adaptação IA de "${pack.nome}" para ${segmento}`,
      } });
      toast.success(`Adaptado ${res.count} mensagens`);
      await onDone(res.pack_key);
    } catch (e) { toast.error(`IA: ${(e as Error).message}`); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><Sparkles className="mr-1 inline h-4 w-4" /> Adaptar com IA</DialogTitle>
          <DialogDescription>Reescreve as 13 mensagens do pack "{pack.nome}" para o segmento informado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div><Label className="text-xs">Segmento alvo *</Label>
            <Input value={segmento} onChange={(e) => setSegmento(e.target.value)}
              placeholder="Ex: Clínicas de fisioterapia" /></div>
          <div><Label className="text-xs">Nome do novo pack (opcional)</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Deixe em branco para nome automático" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void run()} disabled={loading}>
            {loading ? "Adaptando…" : "Gerar com IA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}