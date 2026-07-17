# Configuração Inicial do Negócio (Business Profile + IA)

Objetivo: capturar o contexto do negócio uma única vez, deixar a IA identificar nicho/público/dores/gatilhos e gerar a mensagem inicial de prospecção. Depois disso, esses dados alimentam automaticamente templates, cadência, follow-ups e sugestões.

Sem mudanças arquiteturais: reaproveita RLS por org, `authWithAccess`, Lovable AI Gateway e o padrão de server functions.

---

## 1. Fluxos de tela

### 1.1 Card no Dashboard
- Novo card destacado **"Configure seu Negócio"** no topo do `/dashboard`.
- Só aparece enquanto `business_profile` da org estiver vazio (`onboarding_status <> 'completed'`).
- Botão **Configurar Negócio** → navega para `/meu-negocio`.

### 1.2 Tela `/meu-negocio` (nova rota, dentro de `_authenticated/`)
Formulário simples em 1 passo:

- **Descrição da empresa** (textarea, 3–5 linhas) — seguindo sua sugestão, é o campo principal.
- **Produto/serviço** (input curto, exemplos como chips clicáveis).
- **Cliente ideal** (input curto, exemplos como chips).
- **Cidade/região atendida** (opcional).
- **Diferenciais** (textarea curto, chips de exemplo).

Botão **Analisar com IA**.

### 1.3 Resultado da IA (mesma tela, seção que expande)
Cards read-only com o que a IA identificou:
- Nicho, Público, Linguagem, Tom, Foco
- Dores, Benefícios, Gatilhos
- Tipo de abordagem comercial

Seguido do bloco **Mensagem inicial de prospecção** (editável).

Pergunta: *"Esta mensagem representa corretamente seu negócio?"*
Botões:
- ✓ **Sim, utilizar esta mensagem** → salva tudo, marca `onboarding_status = 'completed'`, volta ao dashboard.
- ✏ **Editar mensagem** → habilita edição do textarea.
- 🔄 **Gerar outra opção** → re-chama a IA só para regerar a mensagem, mantendo a análise.

### 1.4 Menu "Meu Negócio"
- Item no sidebar (todos os papéis) apontando para `/meu-negocio`.
- Reabrir mostra os dados já salvos, editáveis.
- Ao salvar alteração relevante (produto, público, tom, diferenciais), modal:
  *"Deseja atualizar automaticamente todas as mensagens da prospecção?"* → **Sim** / **Não**.
  - **Sim**: regenera templates padrão da org e a mensagem inicial.
  - **Não**: apenas grava o perfil.

---

## 2. Dados (nova tabela)

`public.business_profiles` (1 linha por org):
- Campos de entrada: `description`, `product`, `ideal_customer`, `region`, `differentials`
- Campos gerados pela IA: `niche`, `audience`, `language`, `tone`, `focus`, `pains[]`, `benefits[]`, `triggers[]`, `approach`, `initial_message`
- Controle: `onboarding_status` (`draft` | `completed`), `ai_model`, `ai_version`, `analyzed_at`
- Padrões: `org_id` (FK), `created_at`, `updated_at`

RLS:
- `SELECT/INSERT/UPDATE` para membros da org (helper existente `is_org_member`).
- `GRANT` para `authenticated` + `service_role` (padrão do projeto).

Migração cria a tabela, RLS, GRANTs e trigger `updated_at`. Nenhuma tabela existente é alterada.

---

## 3. Backend (server functions)

Arquivo novo `src/lib/business/business.functions.ts`, todas com `authWithAccess`:

- `getBusinessProfile()` → retorna o perfil da org ativa (ou `null`).
- `saveBusinessInputs(input)` → grava/atualiza campos de entrada (`draft`).
- `analyzeBusinessWithAI()` → chama Lovable AI Gateway (`google/gemini-3.5-flash`, structured output com `Output.object`), grava resultado no registro, retorna JSON completo + mensagem inicial. Não marca como completo.
- `regenerateInitialMessage()` → re-chama IA usando o perfil salvo, gera nova mensagem.
- `confirmBusinessProfile({ initial_message })` → grava mensagem final e marca `onboarding_status = 'completed'`.

Prompt do modelo em pt-BR, pedindo JSON estrito. Fallback resiliente se o schema falhar (parse do texto bruto), padrão já usado no projeto.

---

## 4. Integração com o resto da plataforma (sem refactor)

Ponto único: helper `getActiveBusinessContext(orgId)` (server-side) que retorna nicho, tom, dores, gatilhos e mensagem inicial. Já usado por:

- **Templates de cadência**: quando o usuário criar template novo, oferecer "Gerar com base no meu negócio".
- **IA de mensagens / follow-ups**: os prompts existentes de geração passam a receber o contexto como bloco `system` adicional.
- **Sugestões futuras** (dashboards de insights): recebem o mesmo contexto.

Só encaixe — nenhuma tabela ou fluxo existente muda comportamento se o perfil estiver vazio.

---

## 5. Frontend — arquivos

- `src/routes/_authenticated/meu-negocio.tsx` — nova rota (form + resultado IA + confirmação).
- `src/components/dashboard/BusinessSetupCard.tsx` — card do dashboard, exibido condicionalmente.
- `src/components/business/BusinessProfileForm.tsx` — formulário reutilizável (usado no onboarding e nas edições).
- `src/components/business/AiAnalysisResult.tsx` — cartões de resultado + bloco da mensagem inicial.
- `src/hooks/useBusinessProfile.ts` — `useQuery` + mutations.
- Sidebar: novo item "Meu Negócio".

Validação com Zod, textos em pt-BR, uso dos tokens do design system (sem cores hardcoded).

---

## 6. Segurança e custos

- IA roda só via server function → `LOVABLE_API_KEY` nunca sai do servidor.
- Rate limit simples por org (mesmo padrão de `auditDispatches`): no máximo 10 análises IA / hora.
- Log de auditoria em `user_access_events` opcional (`business_profile.analyzed`, `business_profile.confirmed`).

---

## 7. Fora de escopo (desta entrega)

- Regenerar em massa templates antigos além dos padrão da org.
- Versionamento histórico das análises.
- A/B testing de mensagens.

Podem entrar em iterações futuras.

---

Se aprovar, começo pela migração da tabela `business_profiles`, depois server functions com IA, e por último a UI (card do dashboard + tela).
