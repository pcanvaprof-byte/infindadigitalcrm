import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Save, X, Plus } from "lucide-react";
import {
  AREA_LABEL,
  AREA_OPTIONS,
  COBRANCA_LABEL,
  COBRANCA_OPTIONS,
  COMPLEXIDADE_LABEL,
  COMPLEXIDADE_OPTIONS,
  TIPO_ICON,
  TIPO_LABEL,
  TIPO_OPTIONS,
  type CatalogArea,
  type CatalogCategoria,
  type CatalogCobranca,
  type CatalogComplexidade,
  type CatalogItem,
  type CatalogTipo,
} from "@/lib/catalog/types";
import type { CatalogItemInput } from "@/lib/catalog/api";

export type CatalogItemFormValues = Partial<CatalogItemInput>;

interface Props {
  initial?: CatalogItem | null;
  categorias: CatalogCategoria[];
  onSubmit: (values: CatalogItemFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

function defaults(initial?: CatalogItem | null): CatalogItemFormValues {
  return {
    tipo: initial?.tipo ?? "servico",
    codigo: initial?.codigo ?? "",
    nome_comercial: initial?.nome_comercial ?? "",
    nome_interno: initial?.nome_interno ?? "",
    categoria_id: initial?.categoria_id ?? null,
    subcategoria: initial?.subcategoria ?? "",
    descricao_curta: initial?.descricao_curta ?? "",
    descricao_completa: initial?.descricao_completa ?? "",
    beneficios: initial?.beneficios ?? [],
    entregaveis: initial?.entregaveis ?? [],
    nao_incluso: initial?.nao_incluso ?? [],
    prazo_estimado_dias: initial?.prazo_estimado_dias ?? null,
    complexidade: initial?.complexidade ?? "media",
    prioridade: initial?.prioridade ?? 0,
    area_responsavel: initial?.area_responsavel ?? "comercial",
    tempo_execucao_horas: initial?.tempo_execucao_horas ?? null,
    objetivo: initial?.objetivo ?? "",
    cobranca: initial?.cobranca ?? "implantacao",
    valor_implantacao: initial?.valor_implantacao ?? 0,
    valor_mensal: initial?.valor_mensal ?? 0,
    valor_avulso: initial?.valor_avulso ?? 0,
    ativo: initial?.ativo ?? true,
    ordem: initial?.ordem ?? 0,
    tags: initial?.tags ?? [],
    observacoes_internas: initial?.observacoes_internas ?? "",
  };
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function requiredNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function TagListInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) return setDraft("");
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder ?? "Adicionar e pressionar Enter"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="ml-1 opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function CatalogItemForm({ initial, categorias, onSubmit, onCancel, submitLabel }: Props) {
  const [v, setV] = useState<CatalogItemFormValues>(() => defaults(initial));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setV(defaults(initial));
  }, [initial]);

  function patch<K extends keyof CatalogItemFormValues>(k: K, val: CatalogItemFormValues[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("[CatalogItemForm] submit iniciado", { values: v });
    if (!v.nome_comercial?.trim()) {
      toast.error("Informe o nome comercial");
      console.warn("[CatalogItemForm] bloqueado: nome_comercial vazio");
      return;
    }
    if (categorias.length > 0 && !v.categoria_id) {
      toast.error("Selecione uma categoria");
      console.warn("[CatalogItemForm] bloqueado: categoria_id vazio", { categorias: categorias.length });
      return;
    }
    setSaving(true);
    try {
      const payload: CatalogItemFormValues = {
        ...v,
        codigo: v.codigo?.toString().trim() || null,
        nome_interno: v.nome_interno?.toString().trim() || null,
        subcategoria: v.subcategoria?.toString().trim() || null,
        descricao_curta: v.descricao_curta?.toString().trim() || null,
        descricao_completa: v.descricao_completa?.toString().trim() || null,
        objetivo: v.objetivo?.toString().trim() || null,
        observacoes_internas: v.observacoes_internas?.toString().trim() || null,
        categoria_id: v.categoria_id || null,
        beneficios: v.beneficios ?? [],
        entregaveis: v.entregaveis ?? [],
        nao_incluso: v.nao_incluso ?? [],
        tags: v.tags ?? [],
        valor_implantacao: requiredNumber(v.valor_implantacao),
        valor_mensal: requiredNumber(v.valor_mensal),
        valor_avulso: requiredNumber(v.valor_avulso),
        prioridade: requiredNumber(v.prioridade),
        ordem: requiredNumber(v.ordem),
        prazo_estimado_dias: optionalNumber(v.prazo_estimado_dias),
        tempo_execucao_horas: optionalNumber(v.tempo_execucao_horas),
      };
      await onSubmit(payload);
      console.log("[CatalogItemForm] submit OK");
    } catch (err) {
      console.error("[CatalogItemForm] erro no submit", err);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identidade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade</CardTitle>
          <CardDescription>Como esse item aparece no CRM e na proposta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={v.tipo} onValueChange={(val) => patch("tipo", val as CatalogTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_ICON[t]} {TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Código / SKU interno</Label>
            <Input
              value={v.codigo ?? ""}
              placeholder="ex: GT-MENSAL-01"
              onChange={(e) => patch("codigo", e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Nome comercial *</Label>
            <Input
              value={v.nome_comercial ?? ""}
              placeholder="Como o cliente vê (ex: Gestão de Tráfego Pago - Plano Crescer)"
              onChange={(e) => patch("nome_comercial", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Nome interno</Label>
            <Input
              value={v.nome_interno ?? ""}
              placeholder="Como aparece para a equipe"
              onChange={(e) => patch("nome_interno", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select
              value={v.categoria_id ?? ""}
              onValueChange={(val) => patch("categoria_id", val || null)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Subcategoria (opcional)</Label>
            <Input
              value={v.subcategoria ?? ""}
              placeholder="ex: Meta Ads, Google Ads"
              onChange={(e) => patch("subcategoria", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Descritivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descrição</CardTitle>
          <CardDescription>Conteúdo padrão usado nas propostas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Input
              value={v.descricao_curta ?? ""}
              placeholder="Frase resumo (até 140 caracteres)"
              maxLength={140}
              onChange={(e) => patch("descricao_curta", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição completa</Label>
            <Textarea
              rows={4}
              value={v.descricao_completa ?? ""}
              placeholder="Texto detalhado para uso na proposta"
              onChange={(e) => patch("descricao_completa", e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <TagListInput
              label="Benefícios"
              values={v.beneficios ?? []}
              onChange={(val) => patch("beneficios", val)}
              placeholder="Ex: Mais leads qualificados"
            />
            <TagListInput
              label="Entregáveis"
              values={v.entregaveis ?? []}
              onChange={(val) => patch("entregaveis", val)}
              placeholder="Ex: Pixel instalado"
            />
            <TagListInput
              label="O que NÃO está incluso"
              values={v.nao_incluso ?? []}
              onChange={(val) => patch("nao_incluso", val)}
              placeholder="Ex: Verba de anúncio"
            />
          </div>
        </CardContent>
      </Card>

      {/* Valores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valores</CardTitle>
          <CardDescription>
            Preencha conforme o tipo de cobrança. Os 3 campos coexistem para casos híbridos
            (ex: Setup + Mensalidade).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-1">
            <Label>Tipo de cobrança *</Label>
            <Select
              value={v.cobranca}
              onValueChange={(val) => patch("cobranca", val as CatalogCobranca)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COBRANCA_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{COBRANCA_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor implantação (R$)</Label>
            <Input
              type="number" min={0} step="0.01"
              value={v.valor_implantacao ?? 0}
              onChange={(e) => patch("valor_implantacao", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor mensal (R$)</Label>
            <Input
              type="number" min={0} step="0.01"
              value={v.valor_mensal ?? 0}
              onChange={(e) => patch("valor_mensal", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor avulso (R$)</Label>
            <Input
              type="number" min={0} step="0.01"
              value={v.valor_avulso ?? 0}
              onChange={(e) => patch("valor_avulso", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Produção */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produção</CardTitle>
          <CardDescription>Dados usados pela Ordem de Produção e Dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Área responsável</Label>
            <Select
              value={v.area_responsavel}
              onValueChange={(val) => patch("area_responsavel", val as CatalogArea)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AREA_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{AREA_LABEL[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Complexidade</Label>
            <Select
              value={v.complexidade}
              onValueChange={(val) => patch("complexidade", val as CatalogComplexidade)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPLEXIDADE_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{COMPLEXIDADE_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Input
              type="number"
              value={v.prioridade ?? 0}
              onChange={(e) => patch("prioridade", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Prazo estimado (dias)</Label>
            <Input
              type="number" min={0}
              value={v.prazo_estimado_dias ?? ""}
              onChange={(e) => patch("prazo_estimado_dias", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Tempo de execução (horas)</Label>
            <Input
              type="number" min={0} step="0.5"
              value={v.tempo_execucao_horas ?? ""}
              onChange={(e) => patch("tempo_execucao_horas", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Ordem de exibição</Label>
            <Input
              type="number"
              value={v.ordem ?? 0}
              onChange={(e) => patch("ordem", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* IA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IA — Recomendação</CardTitle>
          <CardDescription>
            A IA usa o <strong>objetivo</strong> e as <strong>tags</strong> para recomendar este item ao montar propostas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Objetivo do serviço</Label>
            <Input
              value={v.objetivo ?? ""}
              placeholder="Ex: Gerar Leads / Vender Produtos / Captar Agendamentos"
              onChange={(e) => patch("objetivo", e.target.value)}
            />
          </div>
          <TagListInput
            label="Tags"
            values={v.tags ?? []}
            onChange={(val) => patch("tags", val)}
            placeholder="Ex: meta-ads, b2c, local"
          />
        </CardContent>
      </Card>

      {/* Status & internos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status & observações internas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4">
            <div>
              <Label className="text-sm">Item ativo</Label>
              <p className="text-xs text-muted-foreground">
                Itens inativos não aparecem para a IA nem para o vendedor ao montar propostas.
              </p>
            </div>
            <Switch
              checked={!!v.ativo}
              onCheckedChange={(checked) => patch("ativo", checked)}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações internas</Label>
            <Textarea
              rows={3}
              value={v.observacoes_internas ?? ""}
              placeholder="Notas para a equipe (não aparecem na proposta)"
              onChange={(e) => patch("observacoes_internas", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : submitLabel ?? "Salvar"}
        </Button>
      </div>
    </form>
  );
}