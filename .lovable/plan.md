# Onda 6 — Maturidade e Adoção

Antes de construir novas telas, consolidar o Cockpit transformando-o em produto multi-tenant configurável, com histórico, alertas, relatórios e insights inteligentes. Cinco fases sequenciais, cada uma utilizável sozinha.

## Fase 1 — Metas Configuráveis por Organização

Substituir os defaults hardcoded (`META_MENSAL`, `META_COMERCIAL`) por valores persistidos e editáveis.

**Banco** (nova tabela única `bi_goals`):
- `organization_id` (FK), `period_type` ('monthly' | 'quarterly' | 'yearly'), `period_start` (date), `metric` (enum), `target_value` (numeric)
- Métricas: `receita`, `leads`, `reunioes`, `propostas`, `contratos`, `ticket_medio`, `roas`, `clientes_ativos`, `conversao_pct`
- Índice único: (organization_id, period_type, period_start, metric)
- RLS por `organization_id`; GRANTs para `authenticated` + `service_role`
- Seed do mês corrente com os defaults atuais (700/100/50/20/15%/R$100k)

**UI** — nova rota `/configuracoes/metas`:
- Tabela editável (mês ⇆ trimestre ⇆ ano) com salvamento inline por célula
- Indicador "real vs meta" ao lado de cada linha
- Item no menu lateral em "Configurações"

**Integração BI**:
- Hook `useMetas(period)` retornando metas resolvidas (fallback para defaults)
- Substituir constantes em `bi.tsx`, `MetaHero`, `ParaBaterMeta`, `EvolucaoMes`, `KpiGoalCard` e `MarketingPanel`

## Fase 2 — Snapshots Diários (`bi_daily_snapshots`)

**Banco**:
- Colunas: `organization_id`, `snapshot_date`, `receita`, `leads`, `contratos`, `propostas`, `reunioes`, `conversao_pct`, `clientes_ativos`, `roas`, `mrr`, `churn_score`, `infinda_score`
- PK: (organization_id, snapshot_date)
- Função `bi_capture_daily_snapshot(org_id)` que lê os mesmos cálculos do RPC v6 e faz UPSERT
- Cron pg_cron diário 03:00 UTC executando para todas as orgs ativas
- Backfill manual via server fn para popular histórico a partir de hoje

**UI** (não bloqueia release):
- Sparklines do dashboard passam a consumir histórico real
- BI ganha seletor "Comparar com período anterior" (vs ontem / 7d / 30d)

## Fase 3 — Centro de Alertas (sino executivo)

**Banco** (`bi_alerts`):
- `organization_id`, `kind` (revenue_below / conversion_drop / churn_up / campaign_silent / contract_expiring), `severity`, `title`, `message`, `payload_json`, `created_at`, `read_at`, `dismissed_at`
- RPC `bi_evaluate_alerts(org_id)` rodando junto do snapshot diário; compara últimos snapshots contra metas e contra média móvel
- Regras iniciais:
  - Receita > 15% abaixo do ritmo ideal acumulado
  - Conversão caiu >5 pp vs últimos 30d
  - Churn alto > 10% da base
  - Campanha ativa sem touchpoint nos últimos 3 dias
  - Contrato vencendo em ≤7 dias

**UI**:
- Ícone de sino no header (`AppShell`) com badge de contagem
- Drawer lateral listando alertas com ações "Marcar como lido" / "Dispensar"

## Fase 4 — Relatório Executivo PDF

Botão "Gerar relatório executivo" no BI.

**Implementação**:
- Server fn `generateExecutiveReportPdf({ month })` autenticada
- Renderiza com `@react-pdf/renderer` (compatível com Worker) ou template HTML → Puppeteer-less (usa `pdfkit` puro)
- Conteúdo: capa, KPIs vs metas, projeções, funil + gargalo, riscos (alertas), próximas ações, INFINDA SCORE
- Estilo Cockpit Dark; logo INFINDA; cabeçalho com período e organização
- Retorna URL assinada (Supabase Storage bucket `reports/`)

## Fase 5 — Insights Inteligentes (LLM)

Atualizar `AIInsightsPanel` para gerar diagnósticos prescritivos.

**Implementação**:
- Server fn `generateExecutiveInsights({ area })` chamando Lovable AI Gateway (`google/gemini-2.5-flash`)
- Prompt estruturado com: KPIs atuais, metas, snapshots (Δ vs 30d), funil com taxas, alertas ativos
- Saída JSON: `[{ severity, title, body, recommendation }]`
- Cache de 1h por (org, area) em `bi_insights_cache` para evitar custo

## Ordem de entrega e validação

1. **Fase 1** sozinha já remove os defaults e libera SaaS multi-cliente.
2. **Fase 2** só passa a fazer sentido após Fase 1 (snapshots gravam meta vs realizado).
3. **Fase 3** depende dos snapshots (média móvel).
4. **Fase 4** depende de 1+2 (PDF usa metas + histórico).
5. **Fase 5** depende de tudo acima (insights cruzam metas, histórico e alertas).

Cada fase é entregue isolada, com migration + UI + integração, testada antes de avançar.

## Decisão necessária

Posso iniciar pela **Fase 1 (Metas Configuráveis)** agora — é a única que destrava as demais. Confirmar?
