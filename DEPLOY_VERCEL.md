# Deploy na Vercel

Este projeto é **TanStack Start v1 + Vite + Nitro**. O build na Vercel usa o
preset `vercel` do Nitro, que emite `.vercel/output` no padrão **Build Output API**.
Server functions (`createServerFn`) e server routes (`createFileRoute(...).server`)
viram automaticamente Vercel Functions (Node runtime).

## 1. Exportar o projeto

1. Em **Lovable → GitHub → Connect** sincronize o repositório.
2. Clone localmente: `git clone <seu-repo>`.

## 2. Importar na Vercel

1. https://vercel.com/new → selecione o repositório.
2. **Framework Preset**: `Other` (o `vercel.json` já configura tudo).
3. **Build Command**: `bun run build` (ou `npm run build`).
4. **Install Command**: `bun install` (ou `npm install`).
5. **Output Directory**: `.vercel/output` (já no `vercel.json`).

## 3. Variáveis de ambiente

Em **Project Settings → Environment Variables**, adicione (veja `.env.example`):

| Nome                              | Tipo     | Origem                                                 |
| --------------------------------- | -------- | ------------------------------------------------------ |
| `SUPABASE_URL`                    | server   | Lovable Cloud → Backend → API URL                      |
| `SUPABASE_PUBLISHABLE_KEY`        | server   | Lovable Cloud → Backend → publishable key              |
| `SUPABASE_SERVICE_ROLE_KEY`       | server   | Lovable Cloud → Backend → service role (manter segredo) |
| `VITE_SUPABASE_URL`               | client   | mesmo valor de `SUPABASE_URL`                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | client   | mesmo valor de `SUPABASE_PUBLISHABLE_KEY`              |
| `VITE_SUPABASE_PROJECT_ID`        | client   | id do projeto Supabase                                 |
| `GROQ_API_KEY`                    | server   | se usar IA de briefings                                |
| `NITRO_PRESET`                    | build    | `vercel` (já no `vercel.json`)                         |

> ⚠️ **Não** prefixe segredos com `VITE_` — eles vazam para o bundle do cliente.

## 4. Banco / Auth (Lovable Cloud / Supabase)

O banco continua hospedado na **Lovable Cloud (Supabase gerenciado)**. A Vercel
só hospeda frontend + funções; nada de schema migra. Em **Supabase → Auth → URL
Configuration**, adicione o domínio da Vercel (ex.: `https://seu-app.vercel.app`)
em **Site URL** e **Redirect URLs** para o login funcionar.

## 5. Pontos de atenção

- **`/api/public/*`**: na Lovable, esse prefixo bypassa auth do site publicado.
  Na Vercel **não existe** essa camada — toda rota é pública por padrão.
  Garanta verificação de assinatura/HMAC dentro do handler (já é exigido no código).
- **`requireSupabaseAuth` + `attachSupabaseAuth`**: continuam funcionando — leem
  `Authorization: Bearer` do request, independente do runtime.
- **`supabaseAdmin`**: depende de `SUPABASE_SERVICE_ROLE_KEY`. Configure na Vercel.
- **Cold starts**: funções Vercel têm cold start. Para webhooks/cron frequentes,
  considere `runtime: "edge"` em rotas específicas (TanStack Start suporta).
- **Cron**: a Lovable Cloud usa `pg_cron`. Continua valendo — aponta para a URL
  pública da Vercel (`https://seu-app.vercel.app/api/public/...`).
- **Domínio customizado**: configure em **Vercel → Domains**. Remova qualquer
  apontamento DNS antigo para `lovable.app`.
- **Logs**: `Vercel → Project → Logs` substitui o tool de logs da Lovable.

## 6. Validação pós-deploy

```bash
# Health-check do SSR
curl -I https://seu-app.vercel.app/

# Server function pública
curl https://seu-app.vercel.app/api/public/<rota>

# Build local (mesmo preset que a Vercel)
NITRO_PRESET=vercel bun run build
ls .vercel/output/
```

## 7. O que NÃO migra automaticamente

- **Lovable Visual Edits / Preview** ficam só na Lovable.
- **Tool de logs de server functions da Lovable** → use Vercel Logs.
- **`browser--*` / sandbox** → não existem fora da Lovable.
- **Build secrets da Lovable** → recriar em Vercel Env Vars.