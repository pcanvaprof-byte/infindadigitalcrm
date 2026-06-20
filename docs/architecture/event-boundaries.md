# Event Boundary Document (EBD)

> Regra travada. Violar isso quebra BI e/ou compliance. Não merge sem revisão.

## Duas verdades, dois sistemas

| Sistema             | Tabela            | Prefixo de tipo | Finalidade                                   | Quem lê                    |
| ------------------- | ----------------- | --------------- | -------------------------------------------- | -------------------------- |
| **Eventos**         | `proposal_events` | `evt_*`         | BI, funil, automações, métricas de negócio   | Views BI, dashboards, IA   |
| **Auditoria**       | `audit_logs`      | `aud_*`         | Compliance, forense, diff estrutural         | Auditoria, suporte, jurídico |

## Regras invioláveis

1. **Views de BI NUNCA fazem JOIN com `audit_logs`.** BI consome apenas `proposal_events` + tabelas de domínio (`proposal_item_decisions`, `proposal_loss_reasons`, `proposal_discount_logs`, `financeiro_previsto`).
2. **Compliance/forense NUNCA consome `proposal_events`.** Diff antes/depois vive só em `audit_logs`.
3. **Triggers são separados.** `tg_evt_*` emite eventos de negócio. `tg_aud_*` grava diff. Nunca o mesmo trigger faz as duas coisas.
4. **Naming dos `event_type`** segue o prefixo:
   - `evt_proposal_created`, `evt_proposal_sent`, `evt_proposal_viewed`, `evt_proposal_downloaded`, `evt_proposal_approved`, `evt_proposal_rejected`, `evt_adjustments_requested`, `evt_item_accepted`, `evt_item_rejected`, `evt_discount_applied`, `evt_briefing_created`, `evt_briefing_completed`, `evt_kickoff_created`, `evt_contract_signed`, `evt_proposal_expired`, `evt_version_created`.
   - `aud_insert`, `aud_update`, `aud_delete` (com `tabela` no payload).
5. **`proposal_events` é append-only.** Nenhum UPDATE/DELETE. Constraint via revogação de GRANT + RLS.
6. **`audit_logs` é append-only.** Mesma regra.
7. **Métricas honestas:** `evt_proposal_viewed` deduplica por `(proposta_id, hash(ip+ua+hora))` — uma view por device por hora. Brute-force/farming não infla MRR previsto nem taxa de conversão.

## Migração de eventos legados

Eventos já gravados em `proposal_events` sem prefixo (`proposal_created`, `proposal_viewed` etc.) ganham um backfill:
```sql
update public.proposal_events set tipo = 'evt_' || tipo where tipo not like 'evt\_%' escape '\';
```
Daqui pra frente todo INSERT obrigatoriamente passa pelo helper `log_evt(proposta_id, tipo, payload)` que prefixa se faltar e valida contra enum branda.

## Snapshot financeiro imutável

`financeiro_previsto` é **INSERT-only** e carrega FK obrigatória `(proposta_id, proposta_versao_id)`. Aprovar por item, aplicar desconto ou alterar quantidade gera **nova versão** da proposta e **novo snapshot**. Snapshots antigos permanecem intactos — é assim que MRR/ARR ficam estáveis no tempo.

View `vw_mrr_atual` resolve pela versão ativa. View `vw_mrr_historico` percorre snapshots por competência.

## Enforcement (não é só documento)

1. **DB-level** (`scripts/migrations/20260630_ebd_enforcement.sql`):
   - `revoke insert on proposal_events from authenticated/anon` — único caminho de escrita é o helper `log_evt()` (SECURITY DEFINER).
   - `check (tipo ~ '^evt_')` — constraint impede tipo sem prefixo.
   - Triggers `tg_pe_append_only` e `tg_aud_append_only` bloqueiam UPDATE/DELETE em `proposal_events` e `audit_logs`.
2. **Client-level** (`src/lib/proposta/events/logEvent.ts`):
   - Única função autorizada a emitir eventos do front. Tipo forte (`ProposalEventType`).
3. **Build-level** (`scripts/lint-ebd.mjs`, wired em `prebuild`):
   - EBD-1: bloqueia `.from("proposal_events").insert(...)` fora do helper.
   - EBD-2: bloqueia views SQL que referenciem `audit_logs`.
   - EBD-3: bloqueia `aud_*` em chamadas a `logEvent`/`log_evt`.
   - Build falha com exit code 1 se qualquer regra for violada.
