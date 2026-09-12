# API de disparo para ferramenta externa

Nova área `/api/public/v1/dispatch/*` na API que já existe, feita para uma plataforma de disparo externa consumir. Autenticação pela mesma chave (`Authorization: Bearer infd_live_...`) criada na aba Chaves de API.

Cada chave já nasce ligada ao usuário que a criou, então a fila e o histórico entregues pela API são exatamente os daquele usuário — nada de outro usuário aparece.

## O que a ferramenta externa poderá fazer

1. **Puxar a fila de leads a disparar** — `GET /api/public/v1/dispatch/queue`
   - Retorna leads com WhatsApp válido, ainda não contactados por esse usuário, sem duplicados (mesma identidade de empresa/CNPJ/telefone entra uma vez só).
   - Filtros opcionais: `limit` (padrão 50, máx 200), `state`, `city`, `niche`.
   - Cada item traz: id, empresa, contato, WhatsApp em formato internacional, cidade/UF, nicho e **a mensagem pronta já personalizada** com os dados do lead.

2. **Puxar o texto da mensagem pronta** — `GET /api/public/v1/dispatch/message?prospect_id=...`
   - Usa a primeira mensagem de prospecção configurada em Meu Negócio (com o modelo da cadência como reserva) e substitui as variáveis do lead.

3. **Registrar o disparo feito** — `POST /api/public/v1/dispatch/sent`
   - Corpo: `prospect_id`, `channel` (whatsapp/ligacao/email), `message`, `external_id` opcional, `sent_at` opcional.
   - Marca o lead como contactado para aquele usuário e grava no histórico, do mesmo jeito que um disparo feito pela tela — então o lead sai da fila e não volta.
   - Repetir o mesmo `external_id` não duplica o registro.

4. **Registrar resposta recebida** — `POST /api/public/v1/dispatch/reply`
   - Corpo: `prospect_id`, `text`, `received_at` opcional, `status` opcional (ex.: interessado, sem interesse, agendado).
   - Grava a resposta no histórico do lead e atualiza o status do lead para aquele usuário.

Erros voltam em português com código claro (`unauthorized`, `not_found`, `validation_error`, `rate_limited`) e toda chamada continua registrada no log de auditoria da chave.

## Documentação

- A especificação em `/api/public/v1/openapi` passa a incluir esses quatro endereços, com exemplos de corpo e resposta.
- A aba Documentação ganha uma seção curta "Integração com ferramenta de disparo": como gerar a chave, o fluxo (puxar fila → disparar → registrar envio → registrar resposta) e um exemplo de chamada.

## Detalhes técnicos

- Novos arquivos: `src/routes/api/public/v1/dispatch.queue.ts`, `dispatch.message.ts`, `dispatch.sent.ts`, `dispatch.reply.ts`, mais um módulo compartilhado `src/lib/api-public/dispatch.server.ts`.
- Todos usam `withApiAuth` de `@/lib/api-public/auth.server` (import dinâmico dentro do handler), `optionsResponse()` para CORS e validação Zod em todo corpo/query.
- Escopo por usuário: `ctx.createdBy` da chave é o `user_id` usado nas leituras e escritas. Nenhum endpoint aceita `user_id` no corpo.
- Fila: `prospects` filtrado por `organization_id = ctx.orgId`, exclui `merged_into IS NOT NULL`, exclui ids com touchpoint de disparo desse `user_id`, aplica dedupe pela mesma chave de identidade de `src/lib/prospect-identity.ts` e normaliza cidade com `src/lib/city-name.ts`.
- Escritas reaproveitam a fonte única `prospect_touchpoints` (`tipo`, `mensagem`, `resultado`, `by_name = "API"`), e o status privado segue o padrão `status:<X>` já usado em `src/lib/prospects-api.ts`. Idempotência de `external_id` guardada no próprio `mensagem`/campo dedicado do touchpoint.
- Mensagem pronta: lê `business_profiles.initial_message` da organização, com fallback no template de cadência, e aplica as mesmas variáveis usadas hoje na Prospecção.
- Sem alteração de schema, sem nova dependência, nenhuma mudança nas telas existentes além do texto novo em `/documentacao`.
