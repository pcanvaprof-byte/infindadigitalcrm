# Plano — Módulo Operações

Novo módulo nativo da INFINDA acessível pela sidebar (mesmo layout, tema, componentes e contexto global). Estrutura preparada para crescer sem mexer no resto do app.

## Navegação

- Novo item **Operações** (ícone `Briefcase`) no `NAV` de `src/components/AppShell.tsx`, posicionado após "Kickoff Produção".
- Rota raiz `/operacoes` é layout com `<Outlet />` e uma barra de tabs horizontal sticky no topo da página (componente `OperacoesTabs`) listando as 8 sub-seções.
- Cada sub-seção é uma rota filha real, com URL própria:
  - `/operacoes` → redireciona para `/operacoes/dashboard`
  - `/operacoes/dashboard`
  - `/operacoes/clientes`
  - `/operacoes/trafego`
  - `/operacoes/kanban`
  - `/operacoes/credenciais` (placeholder "Em breve")
  - `/operacoes/financeiro` (placeholder "Em breve")
  - `/operacoes/agenda` (placeholder "Em breve")
  - `/operacoes/relatorios` (placeholder "Em breve")
- `MobileNav` não muda (continua com 5 ícones); acesso a Operações via "Mais".

## Banco de dados (Lovable Cloud)

Migration `scripts/migrations/20260712_operacoes_core.sql`, sem `org_id` (compartilhado entre usuários autenticados), seguindo o padrão de GRANTs e RLS já adotado.

Tabelas:

- `op_clientes` — id, nome, empresa, contato (email, telefone, whatsapp), status (`ativo|pausado|offboarding|encerrado`), responsavel_id, observacoes, criado_em, atualizado_em.
- `op_trafego_contas` — vincula cliente a contas de mídia (`plataforma` enum: meta_ads, google_ads, tiktok_ads, linkedin_ads; `conta_id_externa`, `nome_conta`, `verba_mensal`, `objetivo`, `status`).
- `op_trafego_campanhas` — cliente_id, plataforma, nome, status, verba, gasto, impressoes, cliques, conversoes, cpa, roas, periodo_inicio, periodo_fim, ultima_sync.
- `op_entregas` — id, cliente_id, titulo, tipo (`criativo|relatorio|otimizacao|reuniao|outro`), responsavel_id, status (`backlog|em_andamento|revisao|entregue`), prazo, descricao, ordem.

Todas com:
- `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated;`
- `GRANT ALL … TO service_role;`
- RLS habilitada com policy `authenticated` (qualquer usuário logado lê/escreve).
- Triggers `updated_at`.

## Telas funcionais

**`/operacoes/dashboard`**
- KPIs: clientes ativos, verba mensal total, gasto no mês, ROAS médio, entregas em atraso.
- Lista "Entregas com prazo nos próximos 7 dias" e "Campanhas pausadas".
- Tudo via `useSuspenseQuery` em `src/lib/operacoes/api.ts`.

**`/operacoes/clientes`**
- Tabela (shadcn `Table`) com busca, filtro por status e botão "Novo cliente".
- Drawer (`Sheet`) lateral para criar/editar com `react-hook-form` + zod.
- Ação rápida: abrir cliente exibe abas internas com contas vinculadas e entregas recentes.

**`/operacoes/trafego`**
- Seletor de cliente no topo.
- Lista de contas vinculadas (cards) e tabela de campanhas com métricas.
- CRUD de contas e campanhas via dialogs. Não integra APIs externas nesta v1 (apenas registro manual / preparado para sync futuro).

**`/operacoes/kanban`**
- 4 colunas (`backlog`, `em_andamento`, `revisao`, `entregue`) usando `@dnd-kit/core` (já estilo dos componentes existentes — se não instalado, usar drag nativo HTML5 simples).
- Cards de `op_entregas` com cliente, prazo, responsável; drag-and-drop atualiza `status`. Dialog para criar/editar entrega.

## Telas placeholder (`/operacoes/credenciais`, `/financeiro`, `/agenda`, `/relatorios`)

Página padronizada com `AppShell`/card central, ícone + título + descrição curta + selo "Em breve". Mesmo estilo das features desabilitadas atuais.

## Estrutura de código

Módulo isolado em `src/modules/operacoes/`:

```text
src/modules/operacoes/
  components/
    OperacoesTabs.tsx
    ClienteForm.tsx
    EntregaCard.tsx
    KanbanBoard.tsx
    CampanhaTable.tsx
    Placeholder.tsx
  api/
    clientes.functions.ts
    trafego.functions.ts
    entregas.functions.ts
    dashboard.functions.ts
  types.ts
  query-keys.ts
```

Rotas em `src/routes/operacoes.tsx` (layout) + `src/routes/operacoes.dashboard.tsx`, `operacoes.clientes.tsx`, `operacoes.trafego.tsx`, `operacoes.kanban.tsx`, `operacoes.credenciais.tsx`, `operacoes.financeiro.tsx`, `operacoes.agenda.tsx`, `operacoes.relatorios.tsx`, `operacoes.index.tsx` (redirect).

Server functions seguem o padrão existente (`createServerFn` + `requireSupabaseAuth` + zod). Reaproveitam `AppShell`, `Card`, `Button`, `Sheet`, `Dialog`, `Badge`, `Table`, design tokens e `NotificationsBell` — nada novo no design system.

## Fora do escopo desta v1

- Integrações reais com Meta/Google Ads API (apenas modelo de dados pronto).
- Permissões por papel dentro de Operações (todos autenticados acessam tudo).
- Multi-tenant por `org_id` (pode ser adicionado depois sem quebrar dados, via migration aditiva).
- Conteúdo funcional de Credenciais, Financeiro, Agenda e Relatórios.
