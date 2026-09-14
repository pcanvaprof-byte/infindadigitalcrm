# Auditoria: leads já disparados voltando para a fila

## O que a auditoria encontrou (dados reais)

Conferi o banco de produção. Os disparos **estão sendo gravados corretamente** (4.113 registros, todos com organização e usuário certos). O problema não é perda de registro — é **repetição do mesmo número de WhatsApp por empresas diferentes**.

A regra atual de "esconder já disparado" identifica a empresa nesta ordem: CNPJ, depois WhatsApp, depois nome+cidade. Como quase toda empresa tem CNPJ, o número de telefone quase nunca é usado na comparação. Resultado: duas empresas com CNPJ diferente e **o mesmo WhatsApp** são tratadas como leads distintos, e a pessoa acaba mandando mensagem duas vezes para o mesmo número.

Quanto isso pesa hoje, por usuário (leads ainda na fila cujo número já foi disparado por aquele usuário):

```text
usuário 1: 659 números disparados -> 701 leads repetidos na fila
usuário 2: 102 números disparados -> 423 leads repetidos na fila
usuário 3: 226 números disparados -> 402 leads repetidos na fila
usuário 4:  27 números disparados -> 195 leads repetidos na fila
```

Além disso há números claramente inválidos ou compartilhados servindo de "contato" para muitas empresas: 4197880145 (179 empresas), 4799999999 (72), 9999999999 (64), 4711111111 (16), 1111111111 (14). Esses são o pior caso: um único disparo "queima" dezenas de leads, e sem a correção a pessoa fica disparando para o mesmo número sem parar.

## O que vou corrigir

1. **Bloqueio pelo número, não só pelo CNPJ.** Se o usuário já disparou para um número de WhatsApp, todos os leads com esse mesmo número saem da fila (e continuam bloqueados na trava de 24h e no aviso de disparo repetido). Passa a valer em Prospecção, no Mapa, na Cadência e na fila da API externa.
2. **Números inválidos deixam de virar disparo.** Sequências repetidas e placeholders (9999999999, 1111111111, 4711111111 e similares) passam a ser tratados como "sem WhatsApp": o lead sai da fila de disparo e aparece no grupo de contato inválido, junto do que já existe para cidade inválida.
3. **Aviso quando o número é compartilhado.** Ao abrir um lead cujo número já foi usado por outra empresa, mostro no card com quantas empresas ele é compartilhado, para a pessoa decidir com contexto.
4. **Limpeza única dos repetidos já na fila.** Marco como "primeiro contato" os leads cujo número já foi disparado por aquele mesmo usuário, para os cerca de 1.700 casos acumulados saírem da fila sem precisar de clique manual.

Cada usuário continua com seu próprio histórico: o bloqueio de número é por usuário, nunca compartilhado entre membros.

## Detalhes técnicos

- `src/lib/prospect-identity.ts`: nova função `getProspectPhoneKeys(p)` devolvendo os números normalizados (WhatsApp e telefone, formato 55DDD…), e `isJunkPhone()` para placeholders/sequências repetidas. `getProspectIdentityKey` mantém o comportamento atual (usado na deduplicação de cadastro); o bloqueio de disparo passa a usar **união** de chave de identidade + chaves de telefone.
- `src/routes/prospeccao.tsx`: `hideDispatched` e `filteredOrdered` passam a construir `dispatchedPhones: Set<string>` a partir dos prospects com status ≠ `nao_contatado` e a esconder/rebaixar qualquer lead cujo telefone esteja no set. Números `isJunkPhone` entram na contagem de "sem WhatsApp".
- `src/lib/dispatch-lock.ts`: `siblingProspectIds` deixa de escolher um único critério (`cnpj` OU `wa` OU `name`) e passa a unir os ids por CNPJ-raiz **e** por telefone normalizado, em uma consulta `in()` por lote.
- `src/lib/api-public/dispatch.server.ts`: `buildQueue` filtra por `isJunkPhone` e mantém um `Set` de telefones já disparados (derivado dos touchpoints do usuário) além do `seenIdentity` atual.
- Migração `scripts/migrations/20260924_dispatch_phone_dedupe.sql`: backfill idempotente inserindo `prospect_touchpoints` (`tipo='status'`, `mensagem='status:primeiro_contato'`, `by_name='Sistema'`) para pares (usuário, prospect) cujo telefone normalizado já tem disparo daquele usuário e que ainda não tenham status, escopado por `organization_id`.
- Verificação: `bunx tsgo --noEmit -p tsconfig.json` e recontagem no banco dos "leads repetidos na fila" por usuário, que deve cair a zero.
