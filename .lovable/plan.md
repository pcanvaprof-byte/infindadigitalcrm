# Auditoria: contatos já disparados voltando para a fila

## Objetivo
Garantir que um contato que você já disparou nunca mais apareça como "não contatado", em nenhuma tela nem na API.

## Etapa 1 — Auditoria nos dados reais (antes de mexer)
- Para cada usuário, listar os leads hoje visíveis como "não contatado" cujo CNPJ, WhatsApp ou telefone já tem disparo registrado por esse mesmo usuário.
- Classificar cada caso pela causa:
  1. Disparo gravado em uma empresa que depois foi mesclada (registro antigo ligado ao duplicado).
  2. Mesmo número escrito de formas diferentes (com/sem 55, com/sem 9, fixo vs. celular).
  3. Disparo feito, mas o registro não foi salvo (clique no WhatsApp sem gravar, sessão caída, API externa recusada).
  4. Lead reimportado como empresa nova depois do disparo.
  5. Filtro "Ocultar leads já disparados por mim" desligado ou ignorado em alguma visão (cards, mapa, exportação, aquecimento).
- Entrego o número de casos por usuário e por causa. O diagnóstico só é confirmado depois desta etapa.

## Etapa 2 — Correções (conforme as causas encontradas)
- Mover o histórico de disparo das empresas mescladas para a empresa que ficou.
- Unificar a comparação de números (remover 55 e o 9 extra antes de comparar).
- Garantir que todo envio grave o registro antes de abrir o WhatsApp, e repetir a gravação se falhar.
- Na importação, marcar automaticamente como "primeiro contato" qualquer empresa nova cujo CNPJ/número já foi disparado pelo usuário.
- Aplicar a mesma regra de bloqueio em Prospecção, Mapa, Aquecimento, Cadência, exportação e fila da API.
- Limpeza única: marcar como "primeiro contato" todos os repetidos encontrados na Etapa 1.

## Etapa 3 — Trava permanente e teste
- Teste automático: lead com disparo (inclusive por número equivalente ou empresa mesclada) nunca aparece como não contatado.
- Rodar a auditoria da Etapa 1 de novo e confirmar zero casos.

## Detalhes técnicos
- Fonte de verdade: `prospect_touchpoints` por `user_id`; chaves de bloqueio de `src/lib/prospect-identity.ts`.
- Arquivos: `prospect-identity.ts`, `prospects-api.ts`, `dispatch-lock.ts`, `api-public/dispatch.server.ts`, `routes/prospeccao.tsx`, `mapa`, `aquecimento`.
- Migração: reatribuir touchpoints de prospects com `merged_into` para o destino; backfill de status privado.
- Bloqueio continua privado por usuário (nunca compartilhado entre membros).
