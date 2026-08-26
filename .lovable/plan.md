# Plano: investigar e corrigir a persistência da sessão

## Objetivo
Analisar o fluxo de autenticação relacionado ao logout inesperado durante ações da aplicação, sem transformar o texto selecionado em conteúdo da interface.

## Etapas
1. Mapear a criação, recuperação, refresh, login, logout e redirecionamentos da sessão.
2. Auditar os handlers da ação que dispara o problema, incluindo chamadas de API, respostas 401, formulários e middleware.
3. Identificar a causa raiz com base no código e nos sinais do preview.
4. Corrigir somente os arquivos e funções envolvidos, preservando funcionalidades não relacionadas e sem usar signOut/signIn como contorno.
5. Validar com typecheck/testes seletivos e reproduzir o fluxo no preview quando possível.

## Critérios de conclusão
- O usuário permanece autenticado antes, durante e após a ação.
- Logout global em outro dispositivo continua funcionando corretamente.
- Nenhum texto da interface é alterado por esta solicitação.
- O resumo final informa a causa, arquivos/funções alterados e validações realizadas.
