## Objetivo

Botão "Testar demo grátis (2h)" na tela de login que cria em segundos uma organização isolada, com dados fictícios já populados, que expira em 2 horas. Após expirar, o usuário vê uma tela dedicada com CTA "Assinar agora"; os dados ficam preservados por 30 dias e são limpos automaticamente depois.

Nenhum comportamento atual de `owner` / `admin` / `member` reais é alterado.

---

## Como o usuário demo vive

- Papel na org demo: `admin` (para ver o produto completo — dashboard, prospecção, cadência, CRM, propostas).
- Acesso registrado em `user_access` com `access_type='demo'` e `expires_at = now() + 2h`.
- Organização é uma nova org "Demo — {timestamp}", totalmente isolada. RLS existente já impede vazamento cruzado.
- Usuário demo consegue navegar, editar e criar registros dentro do próprio sandbox durante as 2h.

---

## Dados fictícios pré-populados

Semente rodada no `handler` de criação:

- 40 prospects em 5 segmentos (Estética, Odonto, Advocacia, Educação, E-commerce), status distribuídos entre `nao_contatado` / `primeiro_contato` / `qualificado` / `fechado_ganho`.
- 12 `cad_leads` em cadência (estágios variados: `M1`, `M2`, `FUP`), com `owner_id = demo user`.
- 6 mensagens em `cad_messages` marcadas como enviadas.
- 5 `clients` (2 com contrato ativo, 1 em onboarding, 2 em relacionamento).
- 4 `deals` no CRM em estágios diferentes.
- 6 tarefas pendentes (`cad_notifications` do próprio usuário demo).
- 1 `business_profile` genérico já preenchido para a org demo.

Todos os inserts usam `service_role` para bypassar RLS na semeadura e sempre com `user_id`/`owner_id`/`organization_id` do sandbox demo.

---

## Fluxo de expiração

1. `check_access_status` passa a **também** aplicar expiração quando `access_type='demo'`, mesmo para papéis privilegiados (owner/admin). Papéis não-demo continuam idênticos — `is_privileged=true` segue ignorando `expires_at` como hoje.
2. Ao chamar qualquer server fn após 2h → middleware `authWithAccess` lança `access_expired` (fluxo já existente).
3. `AppShell` já redireciona para `AccessExpiredScreen`. Só ajustamos essa tela para, quando `access_type==='demo'`, mostrar texto "Sua demonstração expirou" + botão "Assinar agora" (link `/assinatura`).

---

## Limpeza após 30 dias

- Nova coluna `organizations.is_demo boolean not null default false` (só marcada quando é criada por `startDemo`).
- Route `POST /api/public/hooks/cleanup-demos` (bypass de auth do prefixo `/api/public/*`, autenticada por `apikey` = anon key):
  - Acha organizações demo cujo `user_access.expires_at < now() - interval '30 days'` e apaga `organizations` (cascade já limpa filhas: `prospects`, `cad_leads`, `clients`, `deals`, `business_profiles` etc.).
  - Apaga os usuários órfãos correspondentes via `auth.admin.deleteUser`.
- Cron via `pg_cron` + `pg_net`, roda uma vez por dia às 04:00 UTC.

---

## Alterações de código (frontend)

- `src/routes/login.tsx`: adicionar botão secundário "Testar grátis por 2 horas". Handler chama `startDemo`, faz `supabase.auth.signInWithPassword` com as credenciais retornadas, redireciona para `/dashboard`.
- `src/components/access/AccessExpiredScreen.tsx`: quando `access_type==='demo'` renderiza copy demo + botão "Assinar agora".

## Alterações de código (backend)

- `src/lib/access/demo.functions.ts` (novo):
  - `startDemo` (createServerFn, sem middleware — endpoint público) — cria user, org, membership, `user_access` demo, dispara semeadura.
  - Rate limit simples: máximo 3 criações por IP por hora (tabela `demo_signups_log`).
- `src/lib/access/demo.seed.server.ts` (novo, server-only) — funções de semeadura idempotentes.
- `src/routes/api/public/hooks/cleanup-demos.ts` (novo) — endpoint do cron.

## Migração SQL

```sql
-- 1. Marcador de org demo
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_organizations_is_demo ON public.organizations(is_demo) WHERE is_demo;

-- 2. Log anti-abuso de signup demo
CREATE TABLE public.demo_signups_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_signups_log TO service_role;
ALTER TABLE public.demo_signups_log ENABLE ROW LEVEL SECURITY;
-- sem policies: só service_role acessa.

-- 3. check_access_status passa a expirar contas demo mesmo se owner/admin
--    (owner/admin não-demo continuam sem expiração).
CREATE OR REPLACE FUNCTION public.check_access_status() ... ;
```

Detalhe importante: o `CREATE OR REPLACE` da RPC mantém a assinatura e o shape do JSON — nenhum consumidor existente precisa mudar. A única diferença é: se `access_type='demo'` E `expires_at < now()`, retorna `status='expired'` mesmo com papel owner/admin.

---

## Testes manuais (verifico ao final)

1. Login → clico em "Testar 2h" → entro na plataforma como admin de uma org nova.
2. Dashboard mostra leads/clientes/tarefas semeados.
3. Forço `expires_at` para o passado no DB → recarrego → vejo `AccessExpiredScreen` com CTA demo.
4. Owner real (`cardosovaldnei@gmail.com`) continua funcionando normal.
5. Member real (Juliana) continua vendo só seus dados privados.

## Riscos e mitigações

- **Bots criando contas demo**: rate limit por IP + captcha simples (honeypot field) na primeira versão; se abusarem, dá pra plugar hCaptcha depois.
- **Custo do DB por demos abandonados**: cron 30d + índice em `is_demo` evita bloat.
- **Semeadura falhando parcial**: cada bloco é try/catch; se um falhar, o usuário ainda entra — só sem parte dos dados. Logamos o erro server-side.
- **Regressão em Owner/Admin reais**: teste 4 acima; a lógica só ramifica quando `access_type='demo'`.
