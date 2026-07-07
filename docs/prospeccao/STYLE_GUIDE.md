# Guia de Escrita — Templates de Prospecção

> **Alvo:** toda mensagem enviada via `cad_templates`, `NICHE_TEMPLATES` e cadências.
> **Objetivo:** manter tom humano, direto e útil — sem cair no clichê de vendas.

## Regras obrigatórias

1. **Português do Brasil**, tom profissional e conversacional (como quem fala com um colega ocupado).
2. **Entre 60 e 120 palavras** no follow-up 1. Follow-ups subsequentes podem ser mais curtos (30–80 palavras).
3. **No máximo 1 emoji** por mensagem — e só quando reforçar a intenção (👋 abertura, ✅ confirmação, 🚀 boas-vindas). Nunca em follow-ups de reengajamento ou break-up.
4. **Sempre terminar com uma pergunta aberta** que convide resposta (exceto `fechado` e `perdido`).
5. **Foco no benefício concreto do cliente**, não nas features do produto.
6. Usar apenas variáveis suportadas pela engine: `{{primeiro_nome}}`, `{{responsavel}}`, `{{empresa}}`, `{{empresa_curta}}`, `{{empresa_nome}}`, `{{contato}}`, `{{cliente}}`, `{{nome}}`. Qualquer outra chave é removida por `sanitizeTemplateForSend`.

## Proibições

| ❌ Evitar                                        | ✅ Preferir                                             |
| ----------------------------------------------- | ------------------------------------------------------ |
| "Somos especialistas em…"                        | "Ajudamos {{empresa_curta}} a…"                        |
| "Gostaria de apresentar nossa solução"           | "Posso te mostrar em 5 min como funciona?"             |
| "Oferta imperdível / última chance / promoção"   | (Silêncio — não usar linguagem de pressão)             |
| "Estamos entrando em contato para…"              | "Passei aqui rápido pra…"                              |
| "Só passando para reforçar…"                     | Trazer um ângulo novo a cada follow-up                 |
| Jargão corporativo ("sinergia", "alavancar")     | Palavras simples                                       |
| Múltiplos emojis, ALL CAPS, `!!!`                | Pontuação neutra, no máximo 1 emoji                    |
| "Prezado(a) Sr./Sra."                            | `Oi {{primeiro_nome}}` ou `Olá {{primeiro_nome}}`      |
| Blocos longos sem quebra de linha                | 2–4 parágrafos curtos                                  |

## Estrutura por estágio

- **followup_1** — abertura. Contexto de por que o contato faz sentido + benefício concreto + pergunta aberta.
- **followup_2 a 4** — ângulos novos: prova social, benefício direto, mini-case, gatilho de urgência real (não fabricada).
- **followup_5** — mudança de canal (oferecer e-mail/ligação como alternativa).
- **followup_6** — pergunta binária honesta ("é prioridade nos próximos 60 dias?").
- **followup_7 (break-up)** — encerramento educado, sem emoji, deixando a porta aberta.
- **interessado / reuniao_agendada / proposta_enviada / negociacao / fechado / perdido** — mensagens transacionais curtas, factuais, com próximo passo claro.

## Rotação anti-bloqueio

Sempre que possível, cadastrar **3 ou mais variantes** por estágio separadas por `\n---\n`. O runtime faz round-robin para reduzir bloqueios do WhatsApp por padrão repetido.

## Checklist antes de commitar um template

- [ ] Passa pelo `renderTemplate()` sem placeholder desconhecido para o público-alvo?
- [ ] Está entre 60 e 120 palavras (follow-up 1) ou 30–80 (demais)?
- [ ] Nenhum item da coluna "Evitar" acima?
- [ ] Termina com pergunta aberta (quando aplicável)?
- [ ] No máximo 1 emoji?
- [ ] Tom parece humano se lido em voz alta?