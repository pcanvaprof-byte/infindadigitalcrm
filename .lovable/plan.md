# API para agente de IA (Claude)

Vou criar uma **API REST autenticada por chave**, escopada por organização, que o Claude (ou qualquer agente/n8n/Zapier) pode chamar para ler e alterar dados do CRM.

## Como você vai usar

1. Entrar no seu perfil no app → aba nova **"Chaves de API"**
2. Clicar em **"Gerar nova chave"** → aparece uma vez `infd_live_xxxxxxxx...` (copiar e guardar)
3. Colar no Claude/n8n como header `Authorization: Bearer infd_live_...`
4. Todas as chamadas ficam escopadas à sua organização ativa no momento da criação da chave (RLS por org preservado)

## Endpoints (todos em `/api/public/v1/*`)

**Clientes / Prospects**
- `GET  /clients` — lista (filtros: `?q=`, `?status=`, `?limit=`)
- `GET  /clients/:id` — detalhes
- `POST /clients` — cria
- `PATCH /clients/:id` — atualiza (inclui mudança de status/etapa do pipeline)

**Tarefas**
- `GET  /tasks?due=today` — tarefas do dia
- `POST /tasks` — cria tarefa

**Interações / histórico**
- `GET  /clients/:id/interactions` — histórico
- `POST /clients/:id/interactions` — registra nota/ligação/mensagem

**Propostas**
- `POST /proposals` — cria proposta comercial para um cliente

**Meta**
- `GET /me` — devolve org, permissões e limites da chave (útil pro Claude se apresentar)

Todos retornam JSON, com CORS habilitado, validação Zod nos payloads, códigos HTTP corretos (400/401/404/422/429), e rate limit básico por chave.

## Segurança

- Chave gerada com `crypto.randomBytes` — mostrada **uma única vez**; salvamos só o **hash SHA-256** no banco
- Prefixo `infd_live_` para facilitar detecção em vazamento
- Cada chave tem: `nome`, `org_id`, `created_by`, `last_used_at`, `revoked_at`
- Você pode **revogar** a chave a qualquer momento no perfil
- Toda escrita é auditada em uma tabela `api_key_audit_log` (endpoint, status, ip, user-agent)
- Rate limit: 60 req/min por chave (defesa básica contra loop de agente)
- RLS continua ativo: a API monta um cliente Supabase que aplica filtro `org_id = <org da chave>` em toda query — sem service role para leitura de dados de outras orgs

## Documentação

- Página `/api-docs` no app com exemplos `curl`, schema de cada endpoint, e um botão "Testar com sua chave"
- Um `openapi.json` público em `/api/public/v1/openapi.json` (útil pro Claude ler e entender as tools automaticamente)

## Detalhes técnicos

- **Backend**: server routes TanStack em `src/routes/api/public/v1/*.ts` (bypassa auth do site publicado, faz auth própria via header)
- **Migração**: nova tabela `api_keys` (id, org_id, name, key_hash, prefix, last_used_at, revoked_at, created_by, created_at) + `api_key_audit_log` (id, api_key_id, endpoint, method, status, ip, ua, created_at). Ambas com RLS: dono da org lê/gerencia; API valida via `key_hash` usando `supabaseAdmin` só para o lookup da chave — depois usa cliente scoped por org
- **Handler compartilhado**: `src/lib/api-public/auth.server.ts` faz `verifyApiKey(request)` → retorna `{ orgId, keyId }` ou 401. Reusado em todos os endpoints
- **UI**: nova rota `/perfil/api-keys` (ou aba dentro do perfil existente) com listar/criar/revogar

## O que vou entregar em ordem

1. Migração das tabelas `api_keys` + `api_key_audit_log` (com RLS + GRANTs)
2. Helpers server-side: geração de chave, hash, verificação, audit log, rate limit
3. Endpoints REST em `/api/public/v1/*` (clientes, tarefas, interações, propostas, me)
4. Página no perfil para gerenciar chaves
5. Página `/api-docs` com exemplos curl e um `openapi.json`

Posso tocar? Se quiser, corto o escopo do MVP para só **clientes + tarefas + interações** (deixa propostas para uma segunda leva) — me diga.