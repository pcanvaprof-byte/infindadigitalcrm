# Corrigir "column prospects.merged_into does not exist" na Prospecção

## Situação verificada agora

- No banco em uso pelo app (o `.env` aponta para o backend gerenciado), a coluna **existe**: consulta ao catálogo retornou `merged_into`, e a API REST responde `200` para `select=id,merged_into`.
- O erro no console veio de `loadProspectRowsFallback` (`src/lib/prospects-api.ts:178`), que aplica `.is("merged_into", null)` — ou seja, a tela quebrou inteira por causa de um único filtro opcional. Esse log é anterior à criação da coluna (ou de uma sessão com bundle/cache antigo), mas hoje **nada protege** a listagem se o filtro falhar novamente.
- O `.env.example` aponta para outro projeto de backend (`oxmhww…`), onde o script `scripts/migrations/20260819_prospects_dedupe_identity.sql` não foi confirmado como aplicado. Em qualquer ambiente que use esse projeto, o mesmo erro volta.

## O que será feito

1. **Listagem tolerante ao filtro de duplicatas**: em `loadProspectRowsFallback`, detectar o erro `42703` (coluna inexistente) e repetir a consulta sem `.is("merged_into", null)`, registrando um aviso no console em vez de derrubar a tela. Resultado: a Prospecção carrega sempre; a deduplicação apenas deixa de ser aplicada em bancos que não têm a coluna.
2. **Cache da coluna por sessão**: guardar em memória se a coluna existe, para não pagar uma consulta extra em cada página da paginação (a listagem pagina de 1000 em 1000).
3. **Mesmo tratamento nos outros pontos que dependem da coluna**: revisar as consultas de prospecção/mapa/importação que usem `merged_into` e aplicar o mesmo fallback, para não trocar um erro por outro.
4. **Aviso claro ao usuário** quando a listagem cair no modo sem deduplicação (toast discreto de uma vez por sessão), para que duplicatas reaparecendo sejam explicadas em vez de parecerem regressão.
5. **Paridade de banco**: manter `scripts/migrations/20260819_prospects_dedupe_identity.sql` como fonte da migração e documentar no `CHANGELOG.md` que ela precisa rodar via `scripts/migrate-supabase.sh` em qualquer projeto de backend alternativo.

## Detalhes técnicos

- `src/lib/prospects-api.ts`: helper `prospectsHasMergedInto()` com cache em módulo; `loadProspectRowsFallback` monta a query condicionalmente e faz retry único ao receber `code === "42703"`.
- Sem alteração de schema neste passo: a coluna já existe no backend ativo.
- Sem mudança em RLS, grants ou no modelo de permissões.
