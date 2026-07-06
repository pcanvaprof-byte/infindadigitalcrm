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

const SAMPLE_DEFAULTS: Record<string, string> = {
  responsavel: "Ana Souza",
  empresa: "Padaria Trigo Dourado",
  cidade: "Belo Horizonte",
  segmento: "Padaria",
  telefone: "(31) 99999-1234",
  cargo: "Proprietária",
  remetente: "João / Infinda",
  data_reuniao: "quinta às 15h",
  nome: "Ana",
};

function renderPreview(text: string, sample: Record<string, string>) {
  if (!text) return "";
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = sample[key.toLowerCase()];
    return v && v.trim() ? v : `{{${key}}}`;
  });
}

function countUnknownVars(text: string, sample: Record<string, string>) {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
    const k = m[1].toLowerCase();
    if (!sample[k] || !sample[k].trim()) found.add(k);
  }
  return Array.from(found);
}

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
      const list = (data ?? []) as Pack[];
      setPacks(list);
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
          adaptFn={adaptFn as unknown as AdaptFn}
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
  const [sample, setSample] = useState<Record<string, string>>(SAMPLE_DEFAULTS);
  const [showSample, setShowSample] = useState(false);

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

  const previewTitulo = current ? renderPreview(current.titulo, sample) : "";
  const previewCorpo = current ? renderPreview(current.corpo, sample) : "";
  const unknownVars = current ? countUnknownVars(current.corpo + " " + current.titulo, sample) : [];
  const charCount = current?.corpo?.length ?? 0;
  const wordCount = current?.corpo ? current.corpo.trim().split(/\s+/).filter(Boolean).length : 0;
  const totalFilled = items.filter((i) => i.titulo || i.corpo).length;

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
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Editar pack — {pack.nome}</DialogTitle>
          <DialogDescription>
            Edite metadados e as 13 mensagens da cadência. O preview à direita renderiza em tempo real com valores de exemplo.
          </DialogDescription>
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
          <div className="grid gap-3 md:grid-cols-[200px_1fr_300px]">
            <ScrollArea className="max-h-[360px]">
              <div className="space-y-1">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Etapas · {totalFilled}/13 preenchidas
                </p>
                {items.map((it) => (
                  <button key={it.stage} onClick={() => setActiveStage(it.stage)}
                    className={`w-full rounded border px-2 py-1.5 text-left text-[11px] transition ${
                      activeStage === it.stage ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                    }`}>
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate font-medium">{STAGE_LABEL[it.stage] ?? it.stage}</p>
                      {(it.titulo || it.corpo) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
                    </div>
                    <p className="line-clamp-1 text-muted-foreground">{it.titulo || <span className="italic opacity-60">(sem título)</span>}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
            {current && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Título da etapa</Label>
                  <Input value={current.titulo} onChange={(e) => updateCurrent({ titulo: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={current.corpo}
                    onChange={(e) => updateCurrent({ corpo: e.target.value })}
                    rows={10}
                    className="font-mono text-xs"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{charCount} caracteres · {wordCount} palavras</span>
                    {unknownVars.length > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        ⚠ variáveis sem valor: {unknownVars.map((v) => `{{${v}}}`).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">Inserir variável:</span>
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

            {/* Live preview */}
            {current && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-[#0b141a] p-2">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
                    Preview · WhatsApp
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSample((v) => !v)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {showSample ? "Ocultar dados" : "Editar dados exemplo"}
                  </button>
                </div>

                {showSample && (
                  <div className="grid grid-cols-1 gap-1 rounded border border-border/40 bg-background/90 p-2 text-foreground">
                    {VARIABLES.map((v) => (
                      <div key={v} className="flex items-center gap-1">
                        <span className="w-20 shrink-0 text-[10px] text-muted-foreground">{`{{${v}}}`}</span>
                        <Input
                          value={sample[v] ?? ""}
                          onChange={(e) => setSample((prev) => ({ ...prev, [v]: e.target.value }))}
                          className="h-6 text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <ScrollArea className="max-h-[360px] pr-1">
                  <div className="space-y-1.5">
                    {previewTitulo && (
                      <p className="text-[10px] font-medium text-emerald-300/80">
                        {previewTitulo}
                      </p>
                    )}
                    <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-[#005c4b] px-2.5 py-1.5 text-[12px] text-white shadow-sm">
                      {previewCorpo ? (
                        <p className="whitespace-pre-wrap break-words">{previewCorpo}</p>
                      ) : (
                        <p className="italic opacity-60">(mensagem vazia)</p>
                      )}
                      <p className="mt-0.5 text-right text-[9px] text-white/50">agora ✓✓</p>
                    </div>
                    <p className="text-center text-[9px] text-muted-foreground/60">
                      {STAGE_LABEL[current.stage] ?? current.stage}
                    </p>
                  </div>
                </ScrollArea>
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

/* ================= Adapt with AI (Briefing) dialog ================= */

type Briefing = {
  tom: "consultivo" | "formal" | "casual" | "provocativo" | "amigavel";
  objetivo: string;
  publico_alvo: string;
  dor_principal: string;
  proposta_valor: string;
  diferenciais: string;
  cta_preferido: string;
  restricoes: string;
  observacoes: string;
};

const EMPTY_BRIEFING: Briefing = {
  tom: "consultivo",
  objetivo: "",
  publico_alvo: "",
  dor_principal: "",
  proposta_valor: "",
  diferenciais: "",
  cta_preferido: "",
  restricoes: "",
  observacoes: "",
};

type AdaptFn = (opts: {
  data: {
    source_pack_key: string;
    segmento: string;
    briefing?: Partial<Briefing>;
    preview?: boolean;
    new_pack_key?: string;
    nome?: string;
    categoria?: string;
    descricao?: string;
    items_override?: Item[];
  };
}) => Promise<{
  ok: true;
  preview: boolean;
  count: number;
  items?: Item[];
  pack_key?: string;
}>;

function AdaptWithAIDialog({ pack, onClose, onDone, adaptFn }: {
  pack: Pack;
  onClose: () => void;
  onDone: (key: string) => void | Promise<void>;
  adaptFn: AdaptFn;
}) {
  const [step, setStep] = useState<"briefing" | "preview">("briefing");
  const [segmento, setSegmento] = useState("");
  const [nome, setNome] = useState("");
  const [briefing, setBriefing] = useState<Briefing>(EMPTY_BRIEFING);
  const [previewItems, setPreviewItems] = useState<Item[]>([]);
  const [activeStage, setActiveStage] = useState<string>(STAGES[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Briefing>(k: K, v: Briefing[K]) {
    setBriefing((prev) => ({ ...prev, [k]: v }));
  }

  async function gerarPreview() {
    if (!segmento.trim()) return toast.error("Informe o segmento");
    setLoading(true);
    try {
      const res = await adaptFn({
        data: {
          source_pack_key: pack.pack_key,
          segmento: segmento.trim(),
          briefing,
          preview: true,
        },
      });
      const items = (res.items ?? []) as Item[];
      if (items.length === 0) throw new Error("IA não retornou mensagens");
      // Garante 13 stages
      const byStage = new Map(items.map((i) => [i.stage, i]));
      const full = STAGES.map((s) => byStage.get(s) ?? { stage: s, titulo: "", corpo: "" });
      setPreviewItems(full);
      setActiveStage(STAGES[0]);
      setStep("preview");
      toast.success(`Preview gerado: ${items.length} mensagens`);
    } catch (e) {
      toast.error(`IA: ${(e as Error).message}`);
    } finally { setLoading(false); }
  }

  async function regenerar() {
    setPreviewItems([]);
    setStep("briefing");
  }

  async function salvar() {
    setSaving(true);
    try {
      const slug = segmento.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
      const key = `ia_${slug}_${Date.now().toString(36).slice(-4)}`;
      const finalNome = nome.trim() || `${pack.nome} · ${segmento}`;
      const res = await adaptFn({
        data: {
          source_pack_key: pack.pack_key,
          segmento: segmento.trim(),
          briefing,
          preview: false,
          new_pack_key: key,
          nome: finalNome,
          categoria: "custom",
          descricao: `Adaptação IA de "${pack.nome}" para ${segmento}`,
          items_override: previewItems.filter((i) => i.titulo || i.corpo),
        },
      });
      toast.success(`Pack salvo com ${res.count} mensagens`);
      if (res.pack_key) await onDone(res.pack_key);
    } catch (e) {
      toast.error(`Salvar: ${(e as Error).message}`);
    } finally { setSaving(false); }
  }

  const current = previewItems.find((i) => i.stage === activeStage);

  function updatePreviewItem(patch: Partial<Item>) {
    setPreviewItems((prev) => prev.map((i) => i.stage === activeStage ? { ...i, ...patch } : i));
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Sparkles className="mr-1 inline h-4 w-4" /> Adaptar com IA — {pack.nome}
          </DialogTitle>
          <DialogDescription>
            {step === "briefing"
              ? "Preencha o briefing e a IA vai reescrever as 13 mensagens para o seu contexto."
              : "Revise, edite qualquer mensagem, e salve como um novo pack."}
          </DialogDescription>
        </DialogHeader>

        {step === "briefing" && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Segmento alvo *</Label>
                <Input value={segmento} onChange={(e) => setSegmento(e.target.value)}
                  placeholder="Ex: Clínicas de fisioterapia em SP" />
              </div>
              <div>
                <Label className="text-xs">Nome do novo pack (opcional)</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)}
                  placeholder="Automático se em branco" />
              </div>
              <div>
                <Label className="text-xs">Tom de voz</Label>
                <Select value={briefing.tom} onValueChange={(v) => update("tom", v as Briefing["tom"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultivo">Consultivo</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="provocativo">Provocativo</SelectItem>
                    <SelectItem value="amigavel">Amigável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">CTA preferido</Label>
                <Input value={briefing.cta_preferido} onChange={(e) => update("cta_preferido", e.target.value)}
                  placeholder="Ex: Agendar 15min de conversa" />
              </div>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Objetivo da cadência</Label>
                <Textarea rows={2} value={briefing.objetivo} onChange={(e) => update("objetivo", e.target.value)}
                  placeholder="Ex: agendar reunião para apresentar plataforma de fidelidade" />
              </div>
              <div>
                <Label className="text-xs">Público-alvo</Label>
                <Textarea rows={2} value={briefing.publico_alvo} onChange={(e) => update("publico_alvo", e.target.value)}
                  placeholder="Ex: proprietários de clínicas com 2+ profissionais" />
              </div>
              <div>
                <Label className="text-xs">Dor principal do cliente</Label>
                <Textarea rows={2} value={briefing.dor_principal} onChange={(e) => update("dor_principal", e.target.value)}
                  placeholder="Ex: agenda vazia às segundas e faltas sem aviso" />
              </div>
              <div>
                <Label className="text-xs">Proposta de valor</Label>
                <Textarea rows={2} value={briefing.proposta_valor} onChange={(e) => update("proposta_valor", e.target.value)}
                  placeholder="Ex: reduzir 40% das faltas com lembretes automáticos" />
              </div>
              <div>
                <Label className="text-xs">Diferenciais</Label>
                <Textarea rows={2} value={briefing.diferenciais} onChange={(e) => update("diferenciais", e.target.value)}
                  placeholder="Ex: integração com Doctoralia, sem fidelidade" />
              </div>
              <div>
                <Label className="text-xs">Restrições (evitar)</Label>
                <Textarea rows={2} value={briefing.restricoes} onChange={(e) => update("restricoes", e.target.value)}
                  placeholder="Ex: não citar preço, não usar emojis" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Observações livres</Label>
                <Textarea rows={2} value={briefing.observacoes} onChange={(e) => update("observacoes", e.target.value)}
                  placeholder="Qualquer contexto extra que a IA deva considerar" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => void gerarPreview()} disabled={loading || !segmento.trim()}>
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                {loading ? "Gerando preview…" : "Gerar preview com IA"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="rounded border border-primary/30 bg-primary/5 p-2 text-[11px]">
              Segmento: <b>{segmento}</b> · Tom: <b>{briefing.tom}</b>
              {briefing.cta_preferido && <> · CTA: <b>{briefing.cta_preferido}</b></>}
            </div>
            <div className="grid gap-3 md:grid-cols-[200px_1fr_280px]">
              <ScrollArea className="max-h-[420px]">
                <div className="space-y-1">
                  {previewItems.map((it) => (
                    <button key={it.stage} onClick={() => setActiveStage(it.stage)}
                      className={`w-full rounded border px-2 py-1.5 text-left text-[11px] ${
                        activeStage === it.stage ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                      }`}>
                      <p className="truncate font-medium">{STAGE_LABEL[it.stage] ?? it.stage}</p>
                      <p className="line-clamp-1 text-muted-foreground">{it.titulo || <span className="italic opacity-60">(sem título)</span>}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>

              {current && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Título</Label>
                    <Input value={current.titulo} onChange={(e) => updatePreviewItem({ titulo: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea rows={12} className="font-mono text-xs"
                      value={current.corpo} onChange={(e) => updatePreviewItem({ corpo: e.target.value })} />
                  </div>
                </div>
              )}

              {current && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-[#0b141a] p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">Preview WhatsApp</p>
                  <ScrollArea className="max-h-[380px] pr-1">
                    <div className="space-y-1.5">
                      {current.titulo && (
                        <p className="text-[10px] font-medium text-emerald-300/80">
                          {renderPreview(current.titulo, SAMPLE_DEFAULTS)}
                        </p>
                      )}
                      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-[#005c4b] px-2.5 py-1.5 text-[12px] text-white shadow-sm">
                        <p className="whitespace-pre-wrap break-words">
                          {renderPreview(current.corpo, SAMPLE_DEFAULTS) || <span className="italic opacity-60">(vazio)</span>}
                        </p>
                        <p className="mt-0.5 text-right text-[9px] text-white/50">agora ✓✓</p>
                      </div>
                      <p className="text-center text-[9px] text-muted-foreground/60">
                        {STAGE_LABEL[current.stage] ?? current.stage}
                      </p>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button variant="outline" onClick={() => void regenerar()} disabled={saving || loading}>
                Voltar ao briefing
              </Button>
              <Button variant="outline" onClick={() => void gerarPreview()} disabled={saving || loading}>
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                {loading ? "Regenerando…" : "Regenerar tudo"}
              </Button>
              <Button onClick={() => void salvar()} disabled={saving}>
                {saving ? "Salvando…" : "Salvar como novo pack"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}