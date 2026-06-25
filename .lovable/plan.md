# Plano Revisado — Operações Fase 2 (Dados Reais)

Expandir `/operacoes` com 6 áreas novas, persistidas no Supabase. Incorpora os 9 ajustes solicitados.

## 1. Migration (`scripts/migrations/20260714_operacoes_fase2.sql`)

Toda tabela nova inclui:
```sql
owner_id uuid not null references auth.users(id) default auth.uid()
```
Policies por tabela:
```sql
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())
```
+ GRANTs (`authenticated`, `service_role`) + `ENABLE RLS` + trigger `updated_at`.

### Tabelas

**`op_onboarding`** (1:1 com cliente)
- Campos do enunciado, sem `progress`.
- Booleans de integração + redes + `goal_type` + `status`.

**`op_deployments`**
- + `priority text check in ('Baixa','Normal','Alta','Crítica') default 'Normal'`.

**`op_campaigns`**
- + `monthly_budget`, `investment_to_date`, `results_count`, `cost_per_result` (numeric).

**`op_client_interactions`**
- + `next_followup_at timestamptz`.

**`op_contract_renewals`**
- Sem trigger. Cálculo de `days_to_expire` e status via view.

### Views (não armazenam estado derivado)

**`op_onboarding_progress`** — calcula `progress` (%) a partir dos booleans.

**`op_renewals_status`** — calcula `days_to_expire` e status (`Vencido` / `Urgente` / `Próximo Vencimento` / `Ativo`) via `CASE` sobre `CURRENT_DATE`. Respeita `renewal_status` quando `Renovado` ou `Cancelado`.

**`op_dashboard_exec_metrics`** — view (não RPC) com colunas tipadas:
- `total_clientes`, `clientes_ativos`, `clientes_inativos`
- `onboarding_pendente`, `onboarding_em_configuracao`, `onboarding_concluido`
- `deployments_total`, `deployments_concluidos`, `deployments_andamento`
- `campanhas_ativas`, `campanhas_pausadas`, `campanhas_encerradas`
- `interacoes_30d`
- **Saúde Operacional**: `clientes_sem_onboarding`, `clientes_sem_campanha_ativa`, `clientes_com_implantacao_pendente`, `contratos_vencendo_30d`

Todas as views com `security_invoker=on` para respeitar RLS do usuário.

## 2. Types & API (`src/modules/operacoes/`)

- Estender `types.ts` com as 5 interfaces + interfaces das views.
- Estender `api.ts` com CRUDs tipados:
  - Onboarding: `list`, `getByClient`, `upsert`, `listProgress`
  - Deployments: `list(filters)`, `create`, `update`, `delete`
  - Campaigns: `list(filters)`, `create`, `update`, `delete`
  - Interactions: `list(clientId?)`, `create`, `listPendingFollowups`
  - Renewals: `list` (via view de status), `upsert`
  - Dashboard: `getExecutiveMetrics()` lê a view diretamente

Sempre injeta `owner_id = auth.uid()` no insert.

## 3. Rotas novas (`src/routes/`, sob `_authenticated`)

- `operacoes.onboarding.tsx`
- `operacoes.implantacao.tsx`
- `operacoes.campanhas.tsx` (não confunde com `operacoes.trafego.tsx`)
- `operacoes.relacionamento.tsx`
- `operacoes.renovacoes.tsx`
- Atualiza `operacoes.dashboard.tsx` p/ consumir `op_dashboard_exec_metrics`.

Adiciona abas em `OperacoesTabs.tsx`.

## 4. Componentes (`src/modules/operacoes/components/`)

- `OnboardingList.tsx` + `OnboardingFormDialog.tsx` (barra de progresso a partir da view)
- `DeploymentsBoard.tsx` + `DeploymentFormDialog.tsx` (badge de prioridade, filtros cliente/categoria/status/prioridade, busca)
- `CampanhasOpsList.tsx` + `CampanhaOpsFormDialog.tsx` (campos financeiros novos)
- `RelacionamentoTimeline.tsx` + `InteractionFormDialog.tsx` (`next_followup_at`, seção "Follow-ups pendentes")
- `RenovacoesList.tsx` + `RenovacaoFormDialog.tsx` (badge automático)
- `ExecutiveDashboard.tsx` — grid KPIs + bloco "Saúde Operacional"

Usa shadcn `Card`/`Table`/`Dialog`/`Badge`/`Tabs` já presentes; sem alterar visual atual.

## 5. Garantias

- Sem mocks, sem localStorage, sem fallback fake.
- Todas as leituras vão a `useQuery` → Supabase real.
- Loaders nas rotas só fazem `ensureQueryData`; rotas vivem sob `_authenticated`.
- CRM, Prospecção e Cadência intocados.

## 6. Execução & Entrega (não apenas descrição)

Ao final, listar concretamente:
1. Arquivos criados.
2. Arquivos modificados.
3. SQL da migration (incluído no repo).
4. Services implementados (caminhos).
5. Rotas registradas (TanStack regen).
6. Componentes renderizados (caminhos).
7. Evidência de consultas reais (snippets `from('op_*')`).

A implementação fica de fato no código — não apenas descrita.
