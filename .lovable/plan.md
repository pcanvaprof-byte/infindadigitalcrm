## Correções do Dashboard — Ondas A→D

### A. Diagnóstico de `clients` (executar primeiro)
Rodar no SQL Editor para confirmar a causa raiz dos buckets zerados:

```sql
-- 1. Quantos clients existem por org e quantos estão sem org
select 
  count(*) as total,
  count(*) filter (where organization_id is null) as sem_org,
  count(distinct organization_id) as orgs
from public.clients;

-- 2. Distribuição por stage na MINHA org
select pipeline_stage, count(*)
from public.clients
where organization_id = (select organization_id from public.user_active_org where user_id = auth.uid())
group by 1 order by 2 desc;
```

Compartilhar resultado antes de aplicar B (a migration de backfill depende disso).

### B. Migration `20260751_dashboard_fix_zeros.sql`
Três correções no mesmo arquivo:

1. **Backfill `clients.organization_id`** — quando `source_ref` aponta para um `prospects.id`, herda a org do prospect. Para órfãos, atribui à org default da conta dona.
2. **Bucket "Novos" lê de prospects como fallback** — recriar `dashboard_metrics()` v6.1 para que `novos` faça `GREATEST(clients_novos, prospects_em_cadencia_step_0_ou_1)` quando `clients_novos = 0`. Mantém a semântica correta para operações que ainda não promoveram prospects para a tabela `clients`.
3. **Hotfix timezone "Hoje"** — trocar `date_trunc('day', now())` por `date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'` para os buckets `contatos_hoje` e `respostas_hoje`. Idem em `respostas`.

### C. Botão "Marcar resposta" no `LeadDrawer`
Sem isso, a taxa de resposta nunca sai do zero.

- Adicionar botão `<Button>Marcar resposta recebida</Button>` no header do `src/components/cadence/LeadDrawer.tsx`.
- Ao clicar, chama `registerResponse(prospectId, 'whatsapp')` (já existe em `src/lib/cadence/api.ts:647`).
- Toast de sucesso + invalidar queries `["dashboard","v6"]` e a timeline.
- Mostra o botão apenas quando o último touchpoint outbound do lead não tem resposta correspondente.

### D. Projeção rolante de 7 dias reais
Em `src/routes/dashboard.tsx`:

- Adicionar campo `contatos.ultimos_7d` e `respostas.ultimos_7d` na RPC (item B) — janela `now() - interval '7 days'`, não `date_trunc('week')`.
- Atualizar `projectMonth(mes, ultimos_7d)` em `dashboard.tsx:43` para `mes + (ultimos_7d/7) * dias_restantes`.
- Manter o disclaimer já existente: "Projeção = acumulado do mês + (média diária dos últimos 7 dias × dias restantes)".
- Atualizar `DashboardMetrics` type em `src/lib/cadence/api.ts:74` para incluir `ultimos_7d`.

### Fora de escopo (não vou mexer)
- v7 gerencial, v8 multiusuário, BI — continuam off via `FEATURES`.
- Estrutura de prospects/clients/lifecycle — só backfill de coluna existente.

### Detalhes técnicos
- Arquivos: `scripts/migrations/20260751_dashboard_fix_zeros.sql` (novo), `src/lib/cadence/api.ts` (type + projeção arg), `src/routes/dashboard.tsx` (assinatura projectMonth), `src/components/cadence/LeadDrawer.tsx` (botão).
- Fallback client-side em `fetchDashboardMetricsFallback` também ganha `ultimos_7d` para paridade.
- Sem reset de dados, sem alteração de schema destrutiva, sem mexer em RLS existente.
