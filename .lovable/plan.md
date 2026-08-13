# Correção: leads "Não contatado" que aparecem bloqueados para disparo

## O que a auditoria encontrou (perfil Juliana Rufatto Ferreira)

Dados reais do banco de produção:

- 138 prospects receberam disparo de WhatsApp registrado pela Juliana.
- 130 desses continuam com `status = nao_contatado` na tabela compartilhada `prospects` (só 7 estão em `primeiro_contato`, 1 perdido).
- 126 dos 138 têm o registro privado de status (`touchpoint` tipo `status`); 14 disparos ficaram sem esse registro.
- Ela tem 135 leads na cadência, 134 todos parados em `followup_1` com data de próxima ação já vencida.

## Causa raiz confirmada

A trava de 24h (`src/lib/dispatch-lock.ts`) consulta `prospect_touchpoints` **filtrando apenas pelo prospect**, sem filtrar pelo usuário. Como os prospects são compartilhados na organização, um disparo feito por outro usuário bloqueia a Juliana — e, como o status exibido é privado por usuário, o mesmo lead aparece para ela como "Não contatado". Resultado: lead visualmente disponível, mas impossível de disparar, sem explicação.

Um segundo problema, menor: quando o registro privado de status falha (14 casos), o lead só é reclassificado em memória, então a lista pode oscilar entre "Não contatado" e "Primeiro contato" entre recarregamentos.

## O que será feito

1. **Trava por usuário**: a checagem de disparo nas últimas 24h passa a considerar somente os disparos do próprio usuário (touchpoints com o `user_id` da sessão e mensagens de cadência do próprio owner). Assim ninguém é bloqueado pelo trabalho de outro membro.
2. **Trava explicativa quando houver disparo de outro membro**: em vez de bloquear em silêncio, a lista de Prospecção mostra um selo "Já abordado por outro usuário" com a data, e o disparo continua permitido (a decisão fica com o operador). O aviso aparece no diálogo de confirmação do WhatsApp.
3. **Status nunca mais "Não contatado" para quem já disparou**: o leitor de estado privado passa a marcar `primeiro_contato` sempre que existir qualquer disparo do usuário, mesmo sem o registro de status, e o registro que faltou é gravado de forma idempotente na próxima leitura de disparo (corrige os 14 casos da Juliana e casos futuros).
4. **Reconciliação da cadência**: os 134 leads travados em `followup_1` com data vencida entram no fluxo normal de reagendamento já existente, para a fila do dia voltar a fazer sentido.

## Detalhes técnicos

- `src/lib/dispatch-lock.ts`: `wasDispatchedToday` recebe/resolve o `user_id` da sessão; `touchpointToday` filtra `user_id`; `cadMessageToday` filtra por `author_id`/owner. Nova função `lastDispatchByOthers` retorna `{ at, by }` para o aviso informativo.
- `src/routes/prospeccao.tsx`: usa o retorno informativo para renderizar o selo e o texto no diálogo; mantém a trava rígida apenas para disparo próprio nas 24h.
- `src/lib/prospects-api.ts`: em `loadPrivateStatesFromTouchpoints`, disparos (`whatsapp`/`ligacao`/`email`) passam a ter precedência sobre a ausência de registro de status; `logAttempt` grava o touchpoint de status junto ao disparo dentro do mesmo caminho, com verificação de existência.
- Sem migração de banco necessária; nenhuma coluna nova.
