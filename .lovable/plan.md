
## Módulo Cadência Comercial (independente)

Sem tocar em `/prospeccao` nem `/crm`. Nova rota `/cadencia` com persistência real (sem mocks).

### 1. Banco de dados — nova migration `scripts/migrations/20260708_cadencia_module.sql`

Tabelas novas (isoladas, prefixadas `cad_`):

- `cad_leads` — leads em cadência
  - `id uuid pk`, `org_id`, `owner_id` (auth.users), `prospect_id` (fk opcional para `prospects`, somente leitura — nunca grava de volta)
  - `empresa text`, `responsavel text`, `cargo text`, `telefone text`, `whatsapp text`, `email text`
  - `stage cad_stage not null default 'followup_1'`
  - `temperatura cad_temp not null default 'morno'` (`quente|morno|frio`)
  - `primeira_abordagem_at timestamptz not null default now()`
  - `last_contact_at timestamptz`, `next_action_at timestamptz`
  - `last_response_at timestamptz` (preenchido quando registra resposta)
  - `closed_at`, `closed_reason text` (`ganho|perdido|sem_interesse|...`)
  - timestamps padrão
- `cad_messages` — histórico
  - `id`, `lead_id fk`, `org_id`, `author_id`
  - `tipo` (`whatsapp|email|ligacao|nota|sistema`)
  - `direction` (`out|in|system`)
  - `stage_at_send cad_stage` (etapa no momento)
  - `mensagem text`, `status` (`pendente|enviada|respondida`)
  - `created_at`
- `cad_templates` — mensagens padrão por etapa (org-scoped, editáveis)
  - `id`, `org_id`, `stage`, `titulo`, `corpo text` (com `{{empresa}}`, `{{responsavel}}`)
  - seed default com os 7 textos especificados + interessado/reunião

Enums:
- `cad_stage`: `followup_1..7`, `interessado`, `reuniao_agendada`, `proposta_enviada`, `negociacao`, `fechado`, `perdido`
- `cad_temp`: `quente|morno|frio`

RPC:
- `cad_dashboard_metrics()` → jsonb com totais por etapa, interessados, reuniões, propostas, perdidos, taxa_resposta, taxa_conversao, série diária dos últimos 30 dias.
- `cad_advance_stage(lead_id, new_stage)` (registra system message)
- `cad_register_message(lead_id, tipo, mensagem, mark_sent boolean)` — insere `cad_messages`, atualiza `last_contact_at`, agenda `next_action_at` conforme cronograma (D+3, +7, +10, +14, +18, +24, +30).
- `cad_register_response(lead_id, mensagem)` — marca `last_response_at`, esfria/esquenta lead, insere mensagem `direction=in`.

RLS por `org_id` + `owner_id`. GRANTs para `authenticated` e `service_role`. Triggers de `updated_at` e auto-schedule de `next_action_at`.

Seed de `cad_templates` por org via trigger `after insert on organizations` (e backfill no script).

### 2. Frontend

**API client** `src/lib/cadencia/api.ts`
- `listLeads({ stage?, search? })`, `getLead(id)`, `createLead(input)`, `updateLead(id, patch)`
- `moveStage(id, stage)`, `setTemperatura(id, temp)`
- `listMessages(leadId)`, `sendMessage({leadId, tipo, mensagem, markSent})`, `registerResponse(...)`
- `listTemplates()`, `updateTemplate(stage, corpo)`
- `fetchMetrics()` (RPC)
- `renderTemplate(corpo, lead)` — substitui variáveis

**Types** `src/lib/cadencia/types.ts` — enums TS + labels + cronograma de dias.

**Rota** `src/routes/cadencia.tsx`
- Header com tabs: **Dashboard** | **Pipeline** | **Templates**
- Dashboard: cards de KPIs (todos os indicadores listados) + LineChart (recharts já no projeto) de envios/respostas por dia (30d).
- Pipeline: Kanban horizontal com 13 colunas (`STAGES`). Cada coluna mostra contagem + botão "Enviar Mensagem" no topo (abre dialog em batch opcional — V1 abre por card). Card mostra: empresa, responsável, cargo, telefone, primeira abordagem, último contato, próxima ação (badge colorido por atraso), dias sem resposta, ícone de temperatura.
- Drag-and-drop entre colunas via `@dnd-kit/core` (já instalado? verificar; se não, adicionar) — fallback: menu "Mover para…".
- Drawer ao clicar no card: dados completos + Timeline + ações (Enviar, Copiar, Editar, Marcar enviado, Agendar próximo, Mover, Interessado, Perdido).
- Templates: lista editável dos 7+ textos com preview de variáveis.

**Componentes** em `src/components/cadencia/`:
- `CadenciaKanban.tsx`
- `LeadCard.tsx`
- `LeadDrawer.tsx`
- `LeadTimeline.tsx`
- `SendMessageDialog.tsx` (preenche template, permite editar antes de enviar, abre WhatsApp `wa.me/<phone>?text=`)
- `DashboardCadencia.tsx`
- `TemplatesPanel.tsx`
- `TemperaturaBadge.tsx`, `StageBadge.tsx`

**Nav**: adicionar item "Cadência" no `AppShell`/sidebar.

### 3. Integração com Prospecção (somente leitura, não invasiva)

Em `/cadencia` há botão **"Importar de Prospecção"** que lista prospects do usuário ainda não importados (left join contra `cad_leads.prospect_id`) e cria `cad_leads` com `stage=followup_1`, `next_action_at = now()+3d`. Prospecção continua intocada.

### 4. Cronograma de follow-up (canônico)
```
followup_1: +3d
followup_2: +7d  (a partir de followup_1)
followup_3: +10d
followup_4: +14d
followup_5: +18d
followup_6: +24d
followup_7: +30d
```
Calculado em SQL no `cad_register_message`.

### 5. Regras
- 100% persistido, sem mocks/hardcode.
- KPIs vêm da RPC `cad_dashboard_metrics()`.
- Mensagens reais via `cad_messages`.
- Multi-tenant via `org_id` (segue padrão do projeto).
- Cores/tokens: usar `src/styles.css` (sem cores hardcoded em componentes).

### 6. Ordem de execução
1. Criar migration + aplicar.
2. `types.ts` + `api.ts`.
3. Rota + tabs vazias.
4. Dashboard.
5. Kanban + card + drawer + timeline.
6. SendMessageDialog + integração WhatsApp.
7. Templates editor.
8. Botão importar de Prospecção.
9. Nav link.

### Aviso
Módulo grande. Vou implementar em uma única passada, mas validações visuais finas (drag-and-drop, responsividade extrema) ficarão para um ajuste seguinte conforme feedback.
