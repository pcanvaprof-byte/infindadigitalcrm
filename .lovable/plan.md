# Auditoria: leads já disparados que voltam para a fila de prospecção

## O que a auditoria encontrou (base de produção, todos os perfis)

4 perfis com atividade real, 13.064 prospects na organização:

| Perfil (id abreviado) | Disparos | Registros de status | Leads disparados com **duplicata** ainda na fila |
| --- | --- | --- | --- |
| e3c71f7e… | 840 | 1.278 | **260** |
| f8ff286c… | 139 | 202 | **42** |
| 95d2bcef… (Juliana) | 176 | 312 | **45** |
| 18ca99db… | 36 | 70 | **3** |

### Falha 1 — duplicatas de cadastro (causa principal, confirmada)

A tabela `prospects` tem **1.716 CNPJs repetidos (2.066 linhas extras)** e 1.714 nomes de empresa repetidos. O status de contato é privado **por linha de prospect**, não por empresa. Então, quando o operador dispara na linha A, a linha B da mesma empresa continua como "Não contatado" e reaparece na fila — é exatamente o "cliente disparado que está retornando". Isso atinge ~1 em cada 3 leads disparados do perfil mais ativo.

Além disso, a trava de 24h é por `prospect_id`, então a duplicata **não é travada**: o operador dispara de novo no mesmo WhatsApp e queima o lead.

### Falha 2 — status "Perdido"/"Cliente" perdidos na leitura

Dos 1.858 registros de status, **1.374 foram gravados com texto humano** (`Status alterado para "Perdido"`, `"Fechado / Ganho"`, `"Qualificado"`…) e só 484 no formato canônico `status:<chave>`. O leitor só reconhece o formato canônico, então 100 leads marcados como **Perdido** e outros marcados como Qualificado/Fechado voltam a ser lidos como "Primeiro contato". Simulação sobre a base real: 1.090 pares usuário/lead com disparo, 0 caem em "Não contatado" (a trava atual funciona), mas os desfechos manuais são apagados na leitura.

### Falha 3 — leitura de estado privado falha em silêncio

`loadPrivateStatesFromTouchpoints` percorre 13k prospects em ~66 lotes sequenciais e, em qualquer erro de rede, faz `return out` com o mapa **parcial**. Todo lead não coberto volta a aparecer como "Não contatado" naquele carregamento — sintoma intermitente de "voltou tudo pra fila".

## O que será feito

1. **Identidade única de empresa (corrige o retorno)**
   - Migração de deduplicação em `prospects`: para cada grupo com o mesmo CNPJ (raiz de 8 dígitos quando não há 14) ou mesmo nome+cidade, manter a linha mais antiga como canônica, repontar `prospect_touchpoints`, `cad_leads` e dados de enriquecimento para ela e marcar as extras como arquivadas (nova coluna `merged_into uuid` — nada é apagado, dá para reverter).
   - Índice único parcial por organização sobre o CNPJ normalizado para impedir novas duplicatas na importação.
   - Importação passa a casar por CNPJ normalizado (raiz inclusive), não só pela string crua.
2. **Trava e ocultação por empresa, não por linha**: a trava de 24h e o filtro "ocultar leads já disparados por mim" passam a usar a chave de identidade (CNPJ normalizado → WhatsApp normalizado → nome+cidade). Mesmo que sobre alguma duplicata, ela some da fila e fica travada junto com a original.
3. **Status humano é reconhecido e normalizado**: o leitor passa a mapear os rótulos em português (`Perdido`, `Fechado / Ganho`, `Qualificado`, `Agendado`, `Em andamento`…) para as chaves internas, com precedência para o registro **mais recente**; toda gravação nova usa somente `status:<chave>`. Backfill idempotente reescreve os 1.374 registros antigos no formato canônico.
4. **Leitura de estado privado sem falha silenciosa**: lotes em paralelo com retry; se algum lote falhar de vez, a tela avisa "não foi possível carregar seu histórico" em vez de mostrar os leads como não contatados.
5. **Relatório de auditoria por perfil** em `/usuarios` (Owner/Admin): por membro, disparos, leads em cadência, duplicatas ainda pendentes e último disparo — para conferir depois da correção.

## Detalhes técnicos

- `scripts/migrations/2026xxxx_prospects_dedupe_identity.sql`: coluna `merged_into`, função de normalização de CNPJ, merge idempotente com repontamento de FKs, índice único parcial `(organization_id, cnpj_norm) where merged_into is null`, mais GRANTs preservados. Executada por script já existente (`scripts/migrate-supabase.sh`).
- `src/lib/prospect-identity.ts` (novo): `identityKey(prospect)` compartilhado por prospecção, mapa e trava.
- `src/lib/dispatch-lock.ts`: resolve os `prospect_id` irmãos da mesma identidade antes de checar as últimas 24h (mantendo o escopo por usuário já implementado).
- `src/lib/prospects-api.ts`: `normalizePrivateStatus` aceita rótulos humanos; leitura com precedência do evento mais recente; loader paralelo com retry e erro propagado; filtro `merged_into is null` na listagem.
- `src/routes/prospeccao.tsx`: `hideDispatched` e a ordenação de bloqueio usam a identidade da empresa.
- Sem alteração no modelo de permissões: prospects seguem compartilhados por organização e o histórico segue privado por usuário.
