## Visão geral

Vou evoluir o módulo `/bi` para ser o **Cockpit Executivo Premium** da INFINDA, consumindo apenas dados já existentes (CRM, Prospecção, Cadência, Operações, Propostas, Contratos). Sem novos módulos no menu, sem cadastros próprios.

A implementação será dividida em 5 ondas, uma por aba, para garantir que cada entrega esteja estável antes da próxima.

---

## Onda 1 — Diretoria (Cockpit principal)

Já existe `MetaHero` (meta mensal, projeção, gap, probabilidade). Vou completar:

1. **Card "Para bater a meta"** — cálculo automático com base no ticket médio e taxas de conversão históricas:
   - Quanto falta em R$
   - Quantos contratos faltam
   - Quantos leads faltam (gap ÷ taxa_conversão)
   - Quantas reuniões faltam
2. **Card "Evolução do mês"** — ideal acumulado vs realizado, status (NO RITMO / ATENÇÃO / CRÍTICO), ritmo necessário para os dias restantes (R$/dia).
3. **Bloco "Comparativo mês anterior"** — receita, contratos, ticket médio, leads (com Δ% verde/vermelho).
4. **Cards executivos** — reorganizar os KPIs existentes em grid premium: Receita Acumulada, Receita Prevista, Clientes Ativos, Contratos Fechados, Ticket Médio, ROAS, Churn, Crescimento Mensal, MRR.

Backend: nova RPC `bi_diretoria_executive()` que agrega esses números a partir de `contratos`, `propostas`, `cad_leads`, `op_clientes` e snapshot do mês anterior.

---

## Onda 2 — Comercial (Forecast + Funil Executivo)

1. **KPIs com progresso vs meta** (Leads, Reuniões, Propostas, Contratos, Conversão) — barras animadas estilo ClickUp Goals.
2. **Forecast Comercial** — projeção de contratos no fim do mês, gap, probabilidade.
3. **Funil Executivo** — visualização vertical com taxa de conversão entre cada etapa (Leads → Contatos → Reuniões → Propostas → Contratos), destacando o estágio com maior queda.

Backend: estender `bi_dashboard('comercial')` com `metas_comercial`, `forecast_contratos` e `funil_executivo`.

---

## Onda 3 — Financeiro

1. KPIs: Receita realizada, prevista, recorrente (MRR), ticket médio, margem, inadimplência, crescimento mensal.
2. **Forecast financeiro**: receita prevista, recorrente, margem, projeção trimestral.
3. **Fluxo de caixa previsto** — próximas 12 semanas com base em contratos ativos e propostas em fechamento.

Backend: nova RPC `bi_financeiro_forecast()`.

---

## Onda 4 — Marketing

1. KPIs: Investimento, Leads, CPL, CPA, ROAS, ROI, CAC, LTV.
2. **Card Performance** — Investido vs Retorno, ROAS, CAC, com comparativo mês anterior.
3. Reaproveitar `best_hours`, `best_channels`, `top_campaigns` já existentes.

Backend: agregar custo de marketing (Operações) com receita gerada (Contratos).

---

## Onda 5 — Operações

1. **INFINDA SCORE** — indicador proprietário (0-100) calculado por:
   - Onboarding completo (peso 20)
   - Implantação no prazo (peso 20)
   - Campanhas ativas com performance (peso 25)
   - Reuniões de relacionamento em dia (peso 15)
   - Renovações no prazo (peso 20)
   - Faixas: 90+ Excelente, 70+ Saudável, 50+ Atenção, <50 Crítico.
2. **Saúde Operacional** — barras de progresso por área.
3. KPIs: Onboarding, Implantação, Campanhas, Relacionamento, Renovação, Entregas, Pendências.

Backend: nova RPC `bi_operacoes_health()` agregando dados de `op_*`.

---

## Bloco transversal — Insights Executivos (IA)

Substituir o título "Insights IA" por **"Insights Executivos"** (já feito na Onda 0). Refinar prompt para gerar alertas categorizados:
- Alertas de meta (⚠ ritmo, ⚠ gap)
- Alertas de conversão (⚠ taxa caiu / ✅ subiu)
- Alertas financeiros
- Alertas operacionais (Health Score baixo)
- Recomendações práticas com call-to-action ("Faltam 2 contratos até dia 20").

---

## Design system (ClickUp / HubSpot / Salesforce)

- Progress bars animadas com gradiente
- Cards premium glass com borda sutil
- Semáforo verde/amarelo/vermelho via tokens `--success`, `--warning`, `--destructive`
- Comparativos com setas Δ%
- Sparklines em KPIs principais
- Tudo via tokens existentes — sem cores hardcoded

---

## Detalhes técnicos

**Arquivos novos**:
- `src/components/bi/ParaBaterMeta.tsx`
- `src/components/bi/EvolucaoMes.tsx`
- `src/components/bi/ComparativoMesAnterior.tsx`
- `src/components/bi/KpiGoalCard.tsx` (KPI com barra de progresso vs meta)
- `src/components/bi/FunilExecutivo.tsx`
- `src/components/bi/ForecastCard.tsx`
- `src/components/bi/InfindaScore.tsx`
- `src/components/bi/SaudeOperacional.tsx`

**Migrations**:
- `supabase/migrations/20260801_bi_executive_rpcs.sql` — RPCs `bi_diretoria_executive`, `bi_comercial_forecast`, `bi_financeiro_forecast`, `bi_operacoes_health`.

**API**:
- Estender `src/lib/bi/api.ts` com tipos e fetchers das novas RPCs.

**Restrições**:
- Nenhuma tabela nova de cadastro. Apenas RPCs de leitura/agregação.
- Tudo respeitando RLS por `organization_id`.
- Sem mudança no menu lateral.

---

## Ordem de entrega proposta

Sugiro liberar **Onda 1 (Diretoria)** primeiro para você validar visual e cálculos, e na sequência avançar Comercial → Financeiro → Marketing → Operações. Cada onda é commitada de forma independente; se algo precisar de ajuste, isolamos sem afetar as outras abas.

Posso começar pela Onda 1 agora?
