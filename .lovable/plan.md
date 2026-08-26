# Corrigir logout inesperado após disparo + remover mensagem de auditoria

## 1. Mensagem estranha ao entrar na ferramenta

A página inicial (`src/routes/index.tsx`) tem um bloco de texto fixo colado abaixo da página de vendas:

> "Auditoria concluída com sucesso. O mapa agora possui layout responsivo…"

Isso é resíduo de uma edição anterior, não faz parte do produto. Correção: remover o bloco, deixando apenas a página de vendas (`SalesPage`).

## 2. Logout inesperado depois do disparo

O contexto de autenticação (`src/lib/auth-context.tsx`) roda uma revalidação de sessão a cada 60 segundos e também ao voltar o foco para a aba. Hoje a regra é:

```
const stillValid = !error && !!data.user;
if (!stillValid && currentUserId) { limpar storage + logout }
```

Qualquer erro de `getUser()` derruba a sessão — inclusive falha de rede momentânea, que é exatamente o cenário do disparo: o app abre o WhatsApp, o navegador perde/troca de rede, a aba volta ao foco e a revalidação dispara com erro transitório. O usuário é deslogado mesmo com sessão válida no servidor.

Correção proposta:

- Derrubar a sessão **apenas** quando o erro for de autenticação de fato (token inválido/expirado/revogado — usando o `isAuthTokenError` que já existe no arquivo) ou quando a resposta vier sem usuário.
- Erros de rede/transitórios: ignorar e tentar de novo no próximo ciclo.
- Exigir duas falhas de autenticação consecutivas antes de limpar o storage, para não reagir a um único glitch.
- Não revalidar quando o navegador está offline (`navigator.onLine === false`).

Isso preserva o comportamento pedido antes (logout global em outro dispositivo continua derrubando esta aba, pois nesse caso o erro é de token revogado).

## Arquivos alterados

- `src/routes/index.tsx` — remover o parágrafo de auditoria.
- `src/lib/auth-context.tsx` — endurecer `revalidateSession` (só desloga em erro de token, com 2 falhas consecutivas e guarda de offline).

## Verificação

- Typecheck do projeto.
- Conferir na pré-visualização que a home mostra só a página de vendas e que navegar/voltar o foco não desloga.
