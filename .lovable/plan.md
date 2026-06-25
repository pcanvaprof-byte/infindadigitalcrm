# Plano: Client Lifecycle Engine (interno agora, SaaS-ready)

Substitui módulos desconectados (Prospecção / Cadência / Implantação / Operações / Financeiro) por **um único motor de pipeline** com cliente como entidade central, máquina de estados, eventos e automações. UI fica como **views** diferentes da mesma base.

## 1. Entidade central: `clients`

Toda a vida do cliente vive aqui. Status não é um campo só — é um agregado:

```text
clients
├─ id, organization_id, owner_id
├─ name, empresa, cnpj, contato (telefone, email)
├─ created_from           -- prospeccao | cadencia | manual
├─ source_ref             -- id do prospect/lead original
├─ pipeline_stage         -- enum (máquina de estados)
├─ financial_status       -- pendente | confirmado | inadimplente | recorrente
├─ contract_status        -- nao_gerado | enviado | assinado
├─ onboarding_status      -- pendente | em_andamento | concluido
├─ current_step           -- texto livre: próxima ação visível
├─ next_action_date       -- p/ filtros e agenda
├─ activated_at, churned_at
└─ timestamps
```

`pipeline_stage` enum:

```text
PROSPECCAO → CADENCIA → FECHADO → REUNIAO_INICIAL → PROPOSTA →
CONTRATO → ASSINATURA → PAGAMENTO_CONFIRMADO → IMPLANTACAO → ATIVO
(+ CHURNED, PERDIDO)
```

## 2. Máquina de estados + eventos + automações

Três tabelas de suporte:

```text
client_events
  id, client_id, type, payload jsonb, actor_id, created_at

client_transitions   -- log auditável de cada mudança de estado
  id, client_id, from_stage, to_stage, reason, created_at, actor_id

client_automations   -- regras declarativas (futuro override por org)
  id, organization_id, trigger_event, condition jsonb, action jsonb, enabled
```

**Transições disparam eventos via trigger SQL** `clients_on_stage_change`. Cada evento conhecido executa ações:

| Transição                   | Ações automáticas                                                  |
| --------------------------- | ------------------------------------------------------------------- |
| `* → FECHADO`               | criar tarefa "Agendar reunião inicial", abrir onboarding draft     |
| `FECHADO → REUNIAO_INICIAL` | criar `commercial_plans` draft com sugestões de investimento        |
| `REUNIAO_INICIAL → PROPOSTA`| gerar proposta em `proposals` a partir do plano comercial           |
| `PROPOSTA → CONTRATO`       | criar `contratos` vinculado, trava operação (`operations_locked=true`) |
| `CONTRATO → ASSINATURA`     | criar tarefa "Aguardar assinatura", marcar `contract_status=enviado` |
| `ASSINATURA → PAGAMENTO_CONFIRMADO` | libera `financial_status=confirmado`, cria cobrança recorrente |
| `PAGAMENTO_CONFIRMADO → IMPLANTACAO` | aplica template de plano (campanhas + entregas), cria kickoff |
| `IMPLANTACAO → ATIVO`       | libera Operações (`ativacao_liberada=true`), agenda reuniões a cada 15 dias |

Implementação: triggers SQL para o caminho crítico (criação de entidades, locks). Automações flexíveis (templates, agendamento) ficam em funções de aplicação chamadas pela API ao salvar a transição — assim ficam testáveis e plugáveis.

## 3. Guard rails

- `clients.operations_locked boolean default true` — APIs de campanhas/entregas/reuniões verificam essa flag.
- Função `clients_can_advance(client_id, target_stage)` valida pré-requisitos (não dá pra ir de FECHADO → ATIVO pulando contrato).
- Reuniões recorrentes só agendam quando `pipeline_stage = 'ATIVO'`.

## 4. UI: uma base, múltiplas views

Tudo lê de `clients` + joins. Cada rota é uma **lente** sobre o mesmo cliente.

```text
/pipeline       -- Kanban global (todas as etapas, drag entre estágios)
/clients/$id    -- visão 360 (header + tabs)
  ├─ Resumo
  ├─ Comercial   (reunião inicial, plano comercial, proposta)
  ├─ Documentos  (contrato, assinatura)
  ├─ Operações   (campanhas, entregas, reuniões) — bloqueado até ATIVO
  ├─ Financeiro  (cobranças, recorrência, inadimplência)
  └─ Histórico   (timeline única de client_events + client_transitions)
```

Rotas atuais (`/prospeccao`, `/cadencia`, `/propostas`, `/contratos`, `/operacoes`, `/implantacao`) continuam existindo como **filtros pré-aplicados sobre `/pipeline`** (`?stage=PROSPECCAO` etc.) para preservar muscle memory. Internamente todas mostram dados de `clients`.

## 5. Integração com o que já existe

| Atual               | Como entra no motor                                                            |
| ------------------- | ------------------------------------------------------------------------------ |
| `prospects`         | Continua tabela de captura; ao virar lead/qualificado → cria `clients` com stage `CADENCIA` (link via `source_ref`). |
| `cad_leads`         | Mantém pipeline da cadência; ao fechar → `clients.pipeline_stage='FECHADO'`. |
| `proposals`         | Ganha `client_id`. Geração disparada pelo motor.                               |
| `contratos`         | Ganha `client_id`. Assinatura atualiza `clients.contract_status`.              |
| `op_clientes`       | Vira **view** de `clients WHERE pipeline_stage='ATIVO'` (sem perder histórico). |
| `op_campaigns/deliveries/meetings` | Ganham `client_id` direto (em vez de `op_cliente_id`).         |
| `briefings`         | Ganha `client_id`; aparece na aba Comercial.                                   |
| `kickoff`           | Disparado na transição IMPLANTACAO → ATIVO.                                    |

## 6. Backfill automático

Migration popula `clients` a partir do que já existe, mapeando o estado atual:

```text
op_clientes ativos                              → ATIVO (operations_locked=false)
contratos assinados sem cliente em op_clientes  → IMPLANTACAO
contratos enviados não assinados                → ASSINATURA
propostas aprovadas sem contrato                → PROPOSTA
propostas enviadas                              → PROPOSTA
prospects/leads em status de fechamento         → FECHADO
cad_leads ativos                                → CADENCIA
prospects sem cadência                          → PROSPECCAO
```

Cada `client` criado no backfill recebe `client_transitions` com `reason='backfill'` para preservar auditoria.

## 7. SaaS-ready desde já

Já garantido sem custo extra:

- **Multi-tenant**: tudo tem `organization_id`, RLS por org (reusa `current_org_id()` já existente).
- **Owner scoping**: tudo tem `owner_id`.
- **Automações como dados**: `client_automations` permite, no futuro, customizar regras por organização sem deploy.
- **Eventos auditáveis**: `client_events` + `client_transitions` viram base para webhooks, analytics, billing por uso.
- **Templates de plano** (`plan_templates`) já versionados por org.
- **API isolada por feature** (`src/modules/lifecycle/`) para evoluir sem mexer no resto.

O que NÃO entra agora (mas o schema permite plugar depois): billing automático, painel admin de orgs, limites de plano, webhooks externos.

---

## Implementação técnica

### Migration `scripts/migrations/20260716_lifecycle_engine.sql`

1. `create type pipeline_stage as enum (...)`, `client_financial_status`, `client_contract_status`, `client_onboarding_status`.
2. Tabela `clients` + índices (stage, owner, org, next_action_date).
3. `client_events`, `client_transitions`, `client_automations`, `plan_templates` (com seeds 600/1200/2000), `commercial_plans`.
4. FK `client_id` adicionada a: `proposals`, `contratos`, `briefings`, `op_campaigns`, `op_deliveries` (ou cria estas), `op_meetings`, `op_tasks`, `op_contract_renewals`.
5. Trigger `clients_log_transition` — registra mudanças em `client_transitions` e dispara função `clients_apply_automations` para o caminho crítico (criar tarefa, abrir plano, travar/destravar operação).
6. Função `clients_can_advance` (validação de pré-requisitos).
7. **Backfill** em DO block: insere `clients` a partir de `op_clientes`/`contratos`/`proposals`/`cad_leads`/`prospects` na ordem acima, evitando duplicatas por `(source_ref, created_from)`.
8. View `op_clientes_compat` (substitui leitura antiga) e view `client_timeline` (UNION de eventos + transições).
9. RLS por `organization_id` + `owner_id`. GRANTs `authenticated` + `service_role`.

### Código

```text
src/modules/lifecycle/
├─ types.ts                     -- enums + tipos do cliente/evento/transição
├─ api.ts                       -- listClients, getClient, advanceStage, logEvent, getTimeline
├─ stateMachine.ts              -- mapa de transições permitidas + ações por evento
├─ automations/
│   ├─ index.ts                 -- runAutomations(event, ctx) → chama handlers
│   ├─ createMeetingTask.ts
│   ├─ openCommercialPlan.ts
│   ├─ generateProposal.ts      -- reusa src/lib/propostas/api.ts
│   ├─ generateContract.ts      -- reusa src/lib/contratos/api.ts
│   ├─ applyPlanTemplate.ts
│   └─ activateOperations.ts
└─ hooks/
    ├─ useClient.ts
    └─ useClientTimeline.ts
```

### Rotas

- `src/routes/pipeline.tsx` (kanban global)
- `src/routes/clients.tsx` (lista filtrável — substitui visão geral)
- `src/routes/clients.$id.tsx` (layout abas com `<Outlet />`)
- `src/routes/clients.$id.index.tsx` (Resumo)
- `src/routes/clients.$id.comercial.tsx`
- `src/routes/clients.$id.documentos.tsx`
- `src/routes/clients.$id.operacoes.tsx`
- `src/routes/clients.$id.financeiro.tsx`
- `src/routes/clients.$id.historico.tsx`
- Rotas antigas viram redirects/filtros: `/operacoes/clientes` → `/clients?stage=ATIVO`, `/implantacao` → `/pipeline?stage_in=FECHADO,REUNIAO_INICIAL,PROPOSTA,CONTRATO,ASSINATURA`.
- Menu lateral: **Pipeline | Clientes | Financeiro | Catálogo | Configurações** (Operações vira aba dentro do cliente).

### Compatibilidade

- Telas antigas continuam funcionando lendo das views de compatibilidade (`op_clientes_compat`) durante a transição.
- Trava anti-disparo, multi-tenant, sync de contratos: **intactos**.

---

## Entrega proposta (2 ondas)

**Onda 1 (agora):** migration completa + backfill + `src/modules/lifecycle/*` + rotas `/pipeline` e `/clients/$id` com todas as abas + automações críticas (criar tarefa, abrir plano, gerar proposta/contrato, ativar operações) + guard rails. Telas antigas continuam funcionando via views de compatibilidade.

**Onda 2 (depois):** kanban com drag-and-drop entre estágios, automações configuráveis por org pela UI, dashboard executivo do lifecycle (tempo médio por etapa, gargalos, conversão).

Confirma a Onda 1 e eu sigo direto.
