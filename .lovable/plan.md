# Login de d2k.agencia@gmail.com não funciona

## O que encontrei
- A conta `d2k.agencia@gmail.com` foi criada hoje às 13:01 (UTC) no **banco errado**. Foi o banco interno antigo, que não é mais usado.
- A tela de login confere email e senha no banco real da plataforma. Por isso a conta não existe ali e o login é recusado.
- Ainda falta confirmar a causa: primeiro vou ver se a conta existe no banco real.

## Passos
1. Procurar `d2k.agencia@gmail.com` no banco real.
   - Se ela não existir: crio a conta lá, com a senha que você informou, o email já confirmado e o acesso à base compartilhada de prospecção (papel Member, a não ser que você peça outro).
   - Se ela já existir: redefino a senha para a que você informou e confiro se a conta está liberada (trial, demo ou assinatura).
2. Apagar a conta duplicada do banco antigo, para não haver confusão.
3. Descobrir o que criou a conta no banco errado (cadastro de demo, painel de usuários ou outro caminho) e corrigir para que todos os cadastros novos vão para o banco real.
4. Testar o login com essa conta e abrir o Dashboard e a Prospecção.

## Impacto
- Não muda nada para os outros usuários, nem nos leads e disparos.

## Detalhes técnicos
- O registro foi feito por `POST /admin/users` (service_role) no projeto Cloud `cazihq...`. O app autentica no projeto externo `oxmhwwopxurwqcrwgsyf`.
- Vou procurar chamadas de `supabaseAdmin`/`client.server` (por exemplo em `demo.functions.ts` e `access.functions.ts`) que usem o client gerado em vez de `OWN_SB_URL` + `OWN_SB_SERVICE_ROLE_KEY`, e mudar essas chamadas para o projeto externo.
