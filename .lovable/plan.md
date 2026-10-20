# Acelerar o carregamento da Prospecção

## O que deixa a tela lenta hoje
- As empresas são buscadas em blocos de 1.000, um bloco depois do outro.
- O histórico de disparos só começa a ser buscado depois que todas as empresas chegaram. Ele também vem em blocos, um depois do outro.
- Toda vez que você abre a tela, tudo isso começa do zero.

## O que vou fazer
1. **Buscar em paralelo:** primeiro pergunto quantas empresas existem. Depois peço todos os blocos de uma vez. O histórico de disparos é buscado ao mesmo tempo que as empresas.
2. **Abrir na hora:** guardo no navegador uma cópia da última lista carregada. Na próxima vez, a tela mostra essa cópia imediatamente e atualiza em segundo plano, com um pequeno aviso "Atualizando…".
3. **Mostrar aos poucos:** se não houver cópia guardada, a tabela aparece assim que o primeiro bloco chegar. Os filtros e as contagens se completam quando o resto chegar.
4. **Trazer menos dados no histórico:** busco só o que a tela usa para saber o status de cada lead. O texto completo das mensagens só é buscado quando você abre um lead.

## O que não muda
- A trava de disparos continua igual: o que você já disparou continua escondido e não volta para a fila.
- Cada usuário continua vendo só os próprios disparos.
- Os filtros funcionam como hoje.

## Como vou conferir
Vou medir o tempo de abertura antes e depois com a sua conta e com uma conta nova.

## Detalhes técnicos
- `src/lib/prospects-api.ts`: `loadProspectRows` passa a usar `count: 'exact', head: true` e depois `Promise.all` das páginas de `range()`. Os touchpoints são carregados em paralelo com os prospects. A primeira página é publicada cedo via `qc.setQueryData`.
- Cache persistido (IndexedDB, uma chave por usuário e organização) usado como `initialData` / `placeholderData` em `prospectsQ`. É limpo no logout.
- O select de touchpoints fica reduzido a `prospect_id,tipo,resultado,enviado_em` para estado e ordenação. As interações completas são carregadas sob demanda no detalhe do lead.
- `loadOpeningByCnpj` continua em paralelo, sem bloquear a tela.
