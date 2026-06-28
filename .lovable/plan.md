## Onda 6 — Fundação do BI (sem novas telas)

Objetivo: elevar a confiabilidade técnica de **6.8 → 8.5+** antes de qualquer IA/alertas/dashboards novos. Nenhuma UI nova — só fundação, cache e correção de fórmulas.

---

### P1 — `bi_goals` (Metas configuráveis)

**Migration** cria tabela:
- `organization_id`, `period_type` (`monthly|quarterly|yearly`), `year`, `month`/`quarter`
- Metas comerciais: `revenue_goal`, `leads_goal`, `meetings_goal`, `proposals_goal`, `contracts_goal`, `clients_goal`
- Metas marketing/financeiro: `roas_goal`, `cac_goal`, `ltv_goal`, `ticket_goal`
- Metas operacionais semanais (INFINDA): `weekly_revenue_goal`, `weekly_contracts_goal`, `weekly_visits_goal`, `weekly_contacts_goal`, `weekly_dispatches_goal`, `weekly_videos_goal`, `weekly_partnerships_goal`
- Unique constraint por `(organization_id, period_type, year, month, quarter)`
- RLS por organização + GRANTs
- Seed inicial: R$ 68.000/mês, R$ 17.000/semana, 4 contratos, 30 visitas/dia, 40 contatos/dia, 240 disparos/sem, 2 vídeos, 1 parceria

**Helper** `src/lib/bi/goals.ts`: `fetchGoals(period)` com fallback para defaults se vazio. Substitui `META_MENSAL` e `META_COMERCIAL` hardcoded em `bi.tsx`.

---

### P2 — `bi_daily_snapshots` (Histórico real)

**Migration**:
- Tabela com `organization_id`, `snapshot_date` (date), todos os KPIs do dia: `revenue`, `contracts`, `leads`, `meetings`, `proposals`, `mrr`, `arr`, `roas`, `cac`, `ltv`, `clients_active`, `churn_rate`, `infinda_score`, `payload jsonb` (raw)
- Unique `(organization_id, snapshot_date)`
- RLS + GRANTs
- Função `bi_capture_snapshot()` que chama `bi_dashboard` para cada org e faz upsert
- pg_cron 23:55 diário (via `supabase--insert` depois)
- Backfill: gera snapshot de hoje e dos últimos 7 dias com dados atuais (placeholder até cron rodar)

**Helper** `src/lib/bi/snapshots.ts`: `fetchSnapshots(from, to)`, `computeMoM()`, `computeWoW()`, `computeTrend(metric, days)`.

---

### P3 — TanStack Query no BI

Refatorar `src/routes/bi.tsx` removendo `useEffect`+`useState` e adotando:
```ts
queryOptions({
  queryKey: ['bi', area],
  queryFn: () => fetchBIDashboard(area),
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
})
```
- Loader chama `ensureQueryData`
- Component usa `useSuspenseQuery`
- Trocar de aba não refaz fetch enquanto fresh
- Cache hit instantâneo

---

### P4 — Corrigir fórmulas

**`FinanceiroPanel.tsx`:**
- "Margem operacional" → **"Margem de aquisição"** (`receita - mkt`)
- Tooltip explicando que não é margem líquida
- Fluxo de caixa 90d: corrigir duplicidade (`previsao_90d` já inclui 30d) → mostrar apenas `realizado + previsao_90d_incremental`

**Forecast** (`bi.tsx` e RPC):
- Substituir `(realizado/dia) × total` por **média móvel 7/15/30 dias** lida dos snapshots
- Função `bi_forecast_revenue(p_org, p_days)` que retorna projeção baseada em snapshots reais
- Considera dias úteis (`extract(dow) not in (0,6)`)

**LTV** (`bi.tsx`):
- Trocar hint "ticket × 12" por **`ticket × margem × retencao_meses`**
- Adicionar coluna `avg_retention_months` derivada de contratos (default: 12)
- Margem default 0.6 quando não há custo total

---

### P5 — Pipeline stage types estáveis

**Migration**:
- Enum `pipeline_stage_type` (`LEAD`, `CONTACT`, `MEETING`, `PROPOSAL`, `CONTRACT`, `WON`, `LOST`)
- Coluna `stage_type pipeline_stage_type` em `cad_leads` (e nas tabelas que alimentam o funil)
- Backfill por regex atual + manual review (mas regex roda só uma vez no backfill, nunca no runtime)
- Atualizar RPC `bi_dashboard` para agrupar funil por `stage_type` em vez de string

**Frontend** (`bi.tsx:286-291`): remover `findStage(/regex/)`, ler direto dos `stage_type` retornados.

---

### Fora desta fase (entram depois)
- P6 alertas inteligentes
- P7 IA preditiva
- Onda 5.5 Cockpit Operacional (depende de `bi_goals` semanais que entram em P1)

---

### Ordem de execução

1. Migration P1 (`bi_goals`) + seed INFINDA
2. Migration P2 (`bi_daily_snapshots` + função + backfill)
3. Insert pg_cron (snapshot diário)
4. Refactor frontend: P3 (Query) + P4 (fórmulas) + P1 wiring
5. Migration P5 (`stage_type`) + atualização RPC + remoção dos regex

**Confirma para eu iniciar pela P1 (migration `bi_goals`)?**