## Objetivo

Provisionar **Juliana Rufatto Ferreira** (`julianarufatto82@gmail.com`) como **Member**, com troca obrigatória de senha no 1º login e trial de 30 dias controlado no banco. Sem tocar em RLS, prospects, cadência, CRM ou `user_lead_state`.

---

## 1. Migration — `public.user_access` + auditoria + RPC

### `user_access`

```
id uuid pk
user_id uuid unique not null   -- referencia auth.users(id)
organization_id uuid not null
status text not null check in ('active','expired','suspended')
access_type text not null check in ('trial','paid','internal')  default 'trial'
plan_name text null            -- futuro (ex.: 'unico', 'pro')
starts_at timestamptz not null default now()
expires_at timestamptz null    -- null = sem expiração (Owner/Admin/internal)
renewed_at timestamptz null
must_change_password boolean not null default false
created_at, updated_at
```

Grants + RLS:
- `GRANT SELECT ON user_access TO authenticated`; `GRANT ALL ... TO service_role`.
- RLS SELECT: `user_id = auth.uid()` OU `is_org_admin(organization_id)`.
- INSERT/UPDATE/DELETE: apenas `service_role` (server functions admin).
- Trigger `updated_at`.

### `user_access_events`

```
id, user_id, event text
  -- ACCESS_CREATED | ACCESS_RENEWED | ACCESS_EXPIRED
  -- PASSWORD_CHANGED | ACCOUNT_BLOCKED | LOGIN
meta jsonb, created_at
```

RLS SELECT: admin da org do usuário. INSERT: service_role.

### RPC `public.check_access_status()` (SECURITY DEFINER, callable by authenticated)

Retorna:
```
{ status: 'active'|'expired'|'suspended',
  access_type, plan_name, expires_at, days_remaining,
  must_change_password, is_privileged }
```

Regra:
- `current_org_role() in ('owner','admin')` → sempre `active`, `is_privileged=true`, ignora `expires_at`.
- Caso contrário: lê `user_access`. Se `expires_at < now()` e `status='active'` → atualiza `status='expired'` e insere evento `ACCESS_EXPIRED` (idempotente por dia).

---

## 2. Enforcement no backend — camada central

Criar `requireActiveAccess` como **middleware composto que estende `requireSupabaseAuth`**, exportando um único middleware `authWithAccess` a partir de `src/lib/access/auth-with-access.ts`:

- Reutiliza `requireSupabaseAuth` como dependência (`createMiddleware({type:'function'}).middleware([requireSupabaseAuth])`).
- Chama `check_access_status()` uma vez, coloca resultado em `context.access`.
- Rejeita com `403 access_expired` quando `status ∈ {expired, suspended}` e não é privileged.
- Rejeita com `403 password_change_required` quando `must_change_password=true`, exceto lista de exceções (`markPasswordChanged`, `getAccessStatus`).

**Migração das server functions existentes**: um único replace mecânico de `requireSupabaseAuth` → `authWithAccess` em `src/lib/**/*.functions.ts` (equivalente semântico; `context.supabase`, `context.userId` continuam disponíveis). Isso evita editar cada função manualmente e mantém a checagem sempre no fluxo central de autenticação.

Server functions públicas de acesso ficam de fora: `provisionMemberUser`, `renewUserAccess` (usam apenas `requireSupabaseAuth` + verificação de admin), `getAccessStatus` e `markPasswordChanged` (usam apenas `requireSupabaseAuth`).

---

## 3. `provisionMemberUser` (idempotente)

Server function admin (owner/admin da org). Passos:

1. `supabaseAdmin.auth.admin.listUsers({ email })` — se já existir usuário com o e-mail:
   - Não recria em `auth.users`.
   - Garante linhas em `organization_members`, `user_roles`, `user_access` via `INSERT ... ON CONFLICT DO NOTHING`.
   - Retorna `{ created: false, userId }` e **não** gera nova senha.
2. Se não existir: `auth.admin.createUser` com senha temporária forte, `email_confirm=true`.
3. Insere `organization_members(role='member')`, `user_roles(role='member')`, `user_access(status='active', access_type='trial', expires_at=now()+30d, must_change_password=true)`, evento `ACCESS_CREATED`.
4. Retorna `{ created: true, userId, tempPassword, expiresAt }` — senha aparece **uma única vez**.

Idempotência garantida por: (a) `auth.users.email` único; (b) `user_access.user_id` unique; (c) unique já existentes em `organization_members` / `user_roles`.

---

## 4. `renewUserAccess` (admin)

Server function admin:
- Input: `{ userId, days: number, planName?: string }` (validado).
- Verifica que o caller é `owner`/`admin` da mesma org do alvo.
- `UPDATE user_access SET status='active', expires_at = greatest(now(), coalesce(expires_at, now())) + days*interval '1 day', renewed_at = now(), plan_name = coalesce($planName, plan_name)`.
- Insere evento `ACCESS_RENEWED` com meta `{days, planName}`.
- Retorna novo `expires_at`.

UI de renovação **não** faz parte deste escopo — apenas a função fica disponível para uso futuro/admin manual.

---

## 5. Fluxo "trocar senha obrigatório"

- Rota nova `src/routes/_authenticated/alterar-senha.tsx`.
- Guard no layout `_authenticated` (ou em `AppShell`): consulta `getAccessStatus` via TanStack Query no boot; enquanto `must_change_password=true`, força `navigate({ to: '/alterar-senha', replace: true })`.
- Tela: senha atual, nova senha, confirmar → `supabase.auth.updateUser({ password })` + server fn `markPasswordChanged` que zera flag em `user_access` e registra `PASSWORD_CHANGED`.

---

## 6. Trial: expiração e avisos

Hook `useAccessStatus()` lê `getAccessStatus` e invalida em `SIGNED_IN`.

No layout `_authenticated`:
- `status='expired'`/`'suspended'` (e não privileged) → renderiza `<AccessExpiredScreen/>` com título "Acesso expirado", mensagem e botão Sair.
- `days_remaining <= 7` → `<TrialBanner/>` discreto (variações ≤7, ≤3, ≤1).
- Owner/Admin (`is_privileged`) nunca vê banner nem bloqueio.

O backend (item 2) já rejeita chamadas mesmo se o frontend for burlado.

---

## 7. Limpeza de cache no logout / troca de usuário

Estender `handleSignOut` e o efeito de mudança de user id em `auth-context`:
- `queryClient.cancelQueries()` + `queryClient.clear()`.
- Remover chaves `wa_account`, `bonus_mode`, `bi.*`, `pv:*`, `lifecycle-audit-log*` de `localStorage`/`sessionStorage`.
- Reset de stores Zustand relevantes.
- Não tocar em tokens do Supabase.

---

## 8. Validação automática pós-provisionamento

Via `read_query`:
1. `auth.users` contém o novo id.
2. `user_roles.role='member'`.
3. `organization_members` vinculado à INFINDA.
4. `user_access`: `status='active'`, `access_type='trial'`, `expires_at ≈ now()+30d`, `must_change_password=true`.
5. `user_access_events` com `ACCESS_CREATED`.
6. Zero linhas em `user_lead_state`, `cad_leads`, `cad_messages`, `prospect_touchpoints`, `deals`, `clients` para o novo `user_id`.
7. Idempotência: chamar `provisionMemberUser` duas vezes seguidas retorna `{ created:false }` na segunda e não duplica linhas.
8. `pg_policies` diff antes/depois: apenas policies novas de `user_access`/`user_access_events`; nenhuma alteração nas demais.

---

## 9. Relatório final

- Nome, e-mail, role, org.
- Senha temporária (uma vez).
- `expires_at` exato, `access_type='trial'`, `plan_name=null`.
- Resultado de cada check da seção 8.
- Confirmação de que RLS, `user_lead_state`, `prospects`, `cad_leads`, `cad_messages`, `deals`, `clients`, `dashboard_metrics` e `cad_import_from_prospects` permaneceram intactos.

---

## Arquivos afetados

**Migrations (novas, aditivas):**
- `create_user_access.sql`, `create_user_access_events.sql`, `create_check_access_status.sql`.

**Novos:**
- `src/lib/access/access.functions.ts` — `provisionMemberUser`, `renewUserAccess`, `markPasswordChanged`, `getAccessStatus`.
- `src/lib/access/auth-with-access.ts` — middleware composto exportado como `authWithAccess`.
- `src/hooks/useAccessStatus.ts`.
- `src/components/AccessExpiredScreen.tsx`, `src/components/TrialBanner.tsx`.
- `src/routes/_authenticated/alterar-senha.tsx` (ajustar caminho conforme layout).

**Editar:**
- `src/lib/auth-context.tsx` (limpeza de cache ao trocar user id).
- `src/components/AppShell.tsx` (banner + gate `AccessExpiredScreen` + `handleSignOut` estendido).
- Replace mecânico `requireSupabaseAuth` → `authWithAccess` em `src/lib/**/*.functions.ts`.

## Não será alterado

RLS existente, `user_lead_state`, `prospects`, `cad_leads`, `cad_messages`, `deals`, `clients`, `dashboard_metrics`, `cad_import_from_prospects`, políticas de isolamento por usuário.
