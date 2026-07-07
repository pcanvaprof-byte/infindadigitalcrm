# Unificação: Nicho → Pack de Cadência

## Objetivo

Eliminar a duplicidade entre **Biblioteca de Cadência** (packs genéricos multi-estágio) e **Templates por Nicho** (mensagem única por nicho). Cada **nicho** passa a ser um **pack de cadência completo** com todas as etapas.

**Modelo mental final para o usuário:**
> "Escolhi o nicho → esse nicho já tem toda a sequência comercial pronta (abertura + 7 follow-ups + breakup)."

O motor de disparo automático **continua igual** — só muda a origem dos textos.

---

## Arquitetura (banco)

Reaproveitar a infra existente de `cad_template_packs` + `cad_templates` (que já suporta pack → múltiplos estágios), e usar `niche_key` como `pack_key`.

**Novo:**

- Coluna `cad_template_packs.niche_key text` (nullable — packs antigos ficam sem nicho).
- Coluna `cad_leads.pack_key text` já existe implicitamente via `active_template_pack` da org? Precisamos garantir que cada lead memorize o pack usado no momento do disparo (não perder histórico). Se não existir, adicionar `cad_leads.pack_key text` — preenchido na criação do lead a partir do nicho do prospect.
- Migrar as ~N linhas de `cad_niche_templates` (mensagem única atual) para virar o `stage=abertura` de um novo pack `niche_<key>` em `cad_templates`. Os outros 8 estágios (followup_1..7, breakup) são copiados do pack default do sistema como ponto de partida — o usuário edita depois.

**Migração de dados:**

```
para cada niche_key existente em cad_niche_templates (is_current=true):
  1. cria/atualiza cad_template_packs (pack_key='niche_<key>', niche_key='<key>', is_system=false, nome=NICHE_LABELS[key])
  2. insere cad_templates (pack_key='niche_<key>', stage='abertura', corpo=<versão corrente>)
  3. copia os outros 8 estágios do pack default do sistema para esse pack
```

**Histórico preservado:** `cad_niche_templates` **não é dropada** — vira tabela de arquivo. Cadências já disparadas continuam com o texto registrado em `cad_messages.mensagem`.

**Nova RPC / função:**

- `cad_niche_pack_upsert_stage(_niche_key, _stage, _titulo, _corpo)` — salva um estágio de um pack de nicho (equivalente ao `cad_niche_template_save` atual, mas por estágio).
- `cad_get_pack_for_lead(p_lead)` — retorna o `pack_key` a usar para um lead (prioriza `cad_leads.pack_key`, cai para pack do nicho, cai para default da org).

---

## UI

**Rota `/cadencia`:** aba atual "Templates" (packs genéricos) é **removida** e substituída pela nova aba **"Templates por Nicho"**.

**Nova tela dentro de /cadencia (aba Templates):**

```text
┌─────────────────────────┬──────────────────────────────────────┐
│ Nichos (sidebar)        │ Pack: Pizzaria                        │
│ ─────────────           │ ──────────────                        │
│ • Pizzaria     [editado]│ Etapa: [Abertura ▼]                   │
│ • Restaurante           │                                        │
│ • Padaria      [editado]│ Título: [___________________]         │
│ • Clínica               │ Corpo:  ┌──────────────────────────┐  │
│ • Advocacia             │         │                          │  │
│ • …                     │         │ (editor + variantes ---) │  │
│                         │         └──────────────────────────┘  │
│                         │                                        │
│                         │ [Restaurar padrão] [Salvar versão]    │
│                         │                                        │
│                         │ Histórico da etapa • Pré-visualização │
└─────────────────────────┴──────────────────────────────────────┘
```

- Sidebar: lista de nichos (mesma da tela atual `/prospeccao-templates-nicho`).
- Painel direito: **seletor de etapa** (abertura / followup_1..7 / breakup) + editor + preview + histórico.
- Badge "editado" quando qualquer etapa do pack tem override na org.

**Rota `/prospeccao-templates-nicho`:** vira redirect para `/cadencia?tab=templates&nicho=<key>` (não quebrar bookmarks).

---

## Regra de funcionamento (integrações)

- **Prospecção** (`/prospeccao`): ao clicar "gerar mensagem" para um lead, busca `cad_templates` do pack do nicho, estágio `abertura`. Ao disparar, cria o `cad_lead` já com `pack_key='niche_<key>'` gravado.
- **Motor de cadência** (`cad_get_pack_templates`): passa a receber o `pack_key` do próprio lead em vez do `active_template_pack` da org. Sem esse pack (leads antigos), cai para o default.
- **Packs genéricos legados** (`cad_template_packs.is_system=true` sem `niche_key`) continuam existindo no banco para não quebrar leads em cadência, mas ficam **ocultos da UI**.

---

## Detalhes técnicos

**Arquivos a criar/editar:**

- `scripts/migrations/20260806_niche_as_pack.sql` — adiciona colunas, migra dados, cria RPCs.
- `src/lib/cadencia/niche-pack-api.ts` — novo wrapper (listar packs por nicho, get/set estágio, histórico).
- `src/components/cadencia/NichePackEditor.tsx` — novo componente (sidebar + editor por etapa).
- `src/routes/cadencia.tsx` — trocar aba "Templates" pelo novo componente.
- `src/routes/prospeccao-templates-nicho.tsx` — vira redirect.
- `src/components/cadencia/TemplatesPanel.tsx` — deletar (ou manter escondido atrás de flag admin).
- `src/lib/prospeccao/*` — pontos que chamam `listCurrentNicheTemplates` passam a chamar a nova API (mesma forma: `Map<niche_key, corpo_abertura>`).

**Não-objetivos desta entrega:**

- Não mexer no `cad_messages` já disparado (histórico intacto).
- Não migrar leads em cadência para o novo `pack_key` retroativamente — só novos.

---

## Confirmações antes de codar

1. Nomes dos estágios exibidos na UI: mantenho `Abertura`, `Follow-up 1..7`, `Breakup`? (mesmos labels de hoje)
2. Ao criar um pack de nicho novo, copio os textos dos followups do **pack default do sistema** como ponto de partida? (senão o nicho novo nasce com abertura preenchida e followups em branco)
3. Ok esconder totalmente os packs genéricos antigos da UI (a aba "Biblioteca de Cadência" some), ou você prefere manter um item "Padrão do Sistema" na sidebar de nichos como fallback editável?