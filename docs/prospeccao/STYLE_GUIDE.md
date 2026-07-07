# Guia de Escrita — Templates de Prospecção

> **Alvo:** toda mensagem enviada via `cad_templates`, `NICHE_TEMPLATES` e cadências.
> **Objetivo:** manter tom humano, direto e útil — sem cair no clichê de vendas.

## Princípio Fundamental

Toda mensagem deve responder, nos primeiros segundos de leitura, à pergunta que o cliente fará mentalmente:

> **"Por que essa pessoa está falando comigo?"**

O primeiro parágrafo deve deixar isso claro de forma natural, contextualizada e sem parecer uma venda em massa. Se o leitor não entender o motivo do contato na primeira frase, o restante da mensagem é ignorado.

## Regras obrigatórias

1. **Português do Brasil**, tom profissional e conversacional (como quem fala com um colega ocupado).
2. **Entre 60 e 120 palavras** no follow-up 1. Follow-ups subsequentes podem ser mais curtos (30–80 palavras).
3. **No máximo 1 emoji** por mensagem — e só quando reforçar a intenção (👋 abertura, ✅ confirmação, 🚀 boas-vindas). Nunca em follow-ups de reengajamento ou break-up.
4. **Sempre terminar com uma pergunta aberta** que convide resposta (exceto `fechado` e `perdido`).
5. **Foco no benefício concreto do cliente**, não nas features do produto.
6. Usar apenas variáveis suportadas pela engine: `{{primeiro_nome}}`, `{{responsavel}}`, `{{empresa}}`, `{{empresa_curta}}`, `{{empresa_nome}}`, `{{contato}}`, `{{cliente}}`, `{{nome}}`. Qualquer outra chave é removida por `sanitizeTemplateForSend`.

## Primeiro Parágrafo

O primeiro parágrafo é o filtro que decide se a mensagem será lida até o fim.

- Desperte interesse rapidamente.
- Não comece falando da nossa empresa.
- Explique por que aquele contato faz sentido para aquele nicho específico.
- O cliente deve entender imediatamente o contexto — quem é você, por que está falando com ele, e por que agora.

### Evitar

- "Somos especialistas..."
- "Gostaria de apresentar..."
- "Estamos entrando em contato..."
- "Nossa empresa desenvolveu..."

### Preferir

- "Vi que vocês trabalham com..."
- "Passei aqui rapidinho porque..."
- "Achei que essa ideia poderia fazer sentido para vocês..."
- "Percebi que muitas empresas desse segmento enfrentam..."

## Credibilidade

**Nunca afirmar algo que não possa ser comprovado.** Frases infladas destroem confiança na primeira leitura.

Exemplos proibidos:

- "Atendemos várias empresas da sua cidade."
- "Analisei seu negócio."
- "Vi problemas no seu atendimento."
- "Muitos clientes iguais ao seu..."
- "Somos líderes."
- "Somos referência."

Toda afirmação deve ser verdadeira ou facilmente verificável pelo destinatário.

## CTA

Priorizar **CTAs de baixo compromisso** — o objetivo do primeiro contato é abrir conversa, não fechar venda.

Recomendados:

- "Posso te mostrar como funciona?"
- "Faz sentido conhecer?"
- "Quer que eu envie um exemplo?"
- "Posso explicar rapidamente?"
- "Vale a pena eu te mostrar?"

Evitar:

- "Vamos fechar?"
- "Posso emitir uma proposta?"
- "Quando podemos contratar?"
- "Aproveite essa oportunidade."

## Benefícios por Nicho

Cada nicho deve enfatizar benefícios específicos. Mensagens genéricas ("melhoramos seu negócio") não engajam.

| Nicho                  | Benefícios que devem aparecer                             |
| ---------------------- | --------------------------------------------------------- |
| Restaurante            | pedidos, cardápio digital, delivery                       |
| Pizzaria               | montagem de pedidos, combos, WhatsApp                     |
| Hamburgueria           | adicionais, combos, pedidos rápidos                       |
| Cafeteria              | produtos, promoções sazonais                              |
| Confeitaria            | encomendas, catálogo                                      |
| Mercado                | ofertas, organização                                      |
| Açougue                | kits, cortes, promoções                                   |
| Farmácia               | atendimento, consulta rápida                              |
| Pet Shop               | serviços e produtos                                       |
| Barbearia              | serviços e agendamento                                    |
| Salão                  | serviços e atendimento                                    |
| Academia               | planos e modalidades                                      |
| Loja                   | catálogo e atendimento                                    |
| Oficina                | orçamento e serviços                                      |
| Empresas recém-abertas | profissionalismo, divulgação, facilidade de atendimento   |

## Progressão da Cadência

Cada etapa da cadência deve apresentar um **novo motivo para responder**. Repetir a mensagem anterior com outras palavras faz o lead se desengajar mais rápido.

Evitar mensagens que apenas repitam:

- "Só passando..."
- "Reforçando..."
- "Voltando aqui..."
- "Passando novamente..."

Cada follow-up deve acrescentar algo novo: contexto, benefício concreto, mini-exemplo, prova social real, ou uma abordagem diferente (mudar de ângulo, mudar de pergunta, mudar de formato).

## Linguagem Natural

Fale como uma pessoa fala, não como um site institucional.

Evitar:

> "Nossa plataforma permite..."

Preferir:

> "O cliente consegue ver tudo pelo WhatsApp sem precisar perguntar item por item."

Evite frases excessivamente institucionais, voz passiva pesada e substantivos abstratos ("otimização", "maximização", "potencialização").

## Arquitetura das Mensagens (Framework AIDA)

Toda mensagem da cadência deve possuir um objetivo claro. Para garantir consistência entre todos os packs e todos os nichos, as mensagens seguem um framework inspirado em **AIDA (Attention, Interest, Desire, Action)**, adaptado para prospecção via WhatsApp.

A intenção **não** é produzir textos comerciais longos, mas mensagens curtas, naturais e conversacionais — AIDA aqui é uma ordem lógica de argumento, não um roteiro de e-mail marketing.

### Primeiro Contato — estrutura obrigatória

Todo primeiro contato deve seguir esta estrutura, nesta ordem.

#### A — Atenção

As primeiras linhas devem responder imediatamente: **"Por que essa pessoa está falando comigo?"**

Exemplos:

- "Vi que vocês trabalham com..."
- "Passei aqui rapidinho porque..."
- "Achei que essa ideia poderia fazer sentido para vocês..."
- "Percebi que muitas empresas desse segmento acabam enfrentando..."

Evitar:

- "Somos especialistas..."
- "Gostaria de apresentar..."
- "Estamos entrando em contato..."
- "Nossa empresa..."

#### I — Interesse

Apresentar um contexto que faça sentido para o nicho. **Não falar da plataforma. Falar do negócio do cliente.**

Ângulos possíveis: atendimento, pedidos, orçamento, divulgação, organização, agilidade, experiência do cliente.

#### D — Desejo

Mostrar um benefício concreto — **não listar funcionalidades**. Sempre mostrar o resultado para o cliente.

Trocar:

> "Temos um catálogo digital."

Por:

> "O cliente consegue visualizar tudo antes mesmo de entrar em contato."

#### A — Ação

Finalizar com um CTA simples e único. **Nunca utilizar mais de um CTA na mesma mensagem.**

Exemplos:

- "Posso te mostrar?"
- "Faz sentido conhecer?"
- "Quer que eu envie um exemplo?"
- "Posso explicar rapidamente?"

### Estrutura dos Follow-ups

Os follow-ups **não devem repetir** a mensagem anterior. Cada etapa acrescenta um novo motivo para responder.

| Etapa | Objetivo | Como abordar |
| --- | --- | --- |
| Follow-up 1 | Criar curiosidade | Atenção → Benefício → Pergunta |
| Follow-up 2 | Trazer um novo benefício | Economia de tempo, organização, praticidade, atendimento — nunca repetir o texto anterior |
| Follow-up 3 | Apresentar uma mini prova | Experiência comum do mercado, comportamento observado, situações do dia a dia — sem inventar números |
| Follow-up 4 | Responder uma possível objeção | Demora para atualizar, dificuldade de usar, falta de tempo, custo percebido |
| Follow-up 5 | Mudar o formato da conversa | Oferecer e-mail, ligação ou demonstração rápida |
| Follow-up 6 | Pergunta objetiva | "Isso faz sentido para vocês este mês?" / "Vale a pena conversarmos?" / "Está nos planos melhorar esse processo?" |
| Follow-up 7 (break-up) | Encerrar educadamente | Nunca tentar vender novamente, nunca criar urgência falsa — apenas deixar a porta aberta |

### Regras gerais da AIDA

Toda mensagem deve:

- responder rapidamente por que o contato faz sentido;
- apresentar apenas **um** benefício principal;
- possuir apenas **um** CTA;
- parecer escrita por uma pessoa;
- evitar excesso de informações;
- evitar listas de funcionalidades.

### O que NÃO fazer

- Não transformar a mensagem em um texto comercial.
- Não escrever parágrafos longos.
- Não tentar convencer usando pressão.
- Não utilizar gatilhos artificiais.
- Não inventar prova social.
- Não exagerar benefícios.

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

## Blacklist de palavras e expressões

Nenhum destes termos deve aparecer em novos templates — tornam a mensagem indistinguível de spam:

- solução completa
- revolucionário
- inovador
- líder de mercado
- especialistas
- excelência
- potencializar
- alavancar
- transformar seu negócio
- diferencial competitivo
- melhor solução
- alta performance
- oferta imperdível
- última chance
- promoção exclusiva

## Estrutura por estágio

- **followup_1** — abertura. Contexto de por que o contato faz sentido + benefício concreto + pergunta aberta.
- **followup_2 a 4** — ângulos novos: prova social, benefício direto, mini-case, gatilho de urgência real (não fabricada).
- **followup_5** — mudança de canal (oferecer e-mail/ligação como alternativa).
- **followup_6** — pergunta binária honesta ("é prioridade nos próximos 60 dias?").
- **followup_7 (break-up)** — encerramento educado, sem emoji, deixando a porta aberta.
- **interessado / reuniao_agendada / proposta_enviada / negociacao / fechado / perdido** — mensagens transacionais curtas, factuais, com próximo passo claro.

### Break-up (detalhamento)

O objetivo do break-up **não é insistir**. É encerrar o contato educadamente e deixar a porta aberta para o futuro.

Exemplo:

> "Vou encerrar esse contato para não ficar te incomodando. Se em algum momento fizer sentido organizar melhor o atendimento pelo WhatsApp, é só me chamar."

Sem pressão, sem última chance, sem "última oportunidade" — só encerramento honesto.

## Rotação anti-bloqueio

Sempre que possível, cadastrar **3 ou mais variantes** por estágio separadas por `\n---\n`. O runtime faz round-robin para reduzir bloqueios do WhatsApp por padrão repetido.

## Checklist antes de commitar um template

- [ ] Passa pelo `renderTemplate()` sem placeholder desconhecido para o público-alvo?
- [ ] Está entre 60 e 120 palavras (follow-up 1) ou 30–80 (demais)?
- [ ] Nenhum item da coluna "Evitar" acima?
- [ ] Termina com pergunta aberta (quando aplicável)?
- [ ] No máximo 1 emoji?
- [ ] Tom parece humano se lido em voz alta?
- [ ] O primeiro parágrafo responde por que aquele contato faz sentido?
- [ ] Existe um benefício específico para o nicho (ver tabela)?
- [ ] A mensagem parece escrita por uma pessoa, não por um script?
- [ ] Nenhuma frase da blacklist?
- [ ] O CTA é de baixo compromisso?
- [ ] Cada follow-up traz uma informação nova em relação ao anterior?
- [ ] Nenhuma afirmação que não possa ser comprovada?
- [ ] O primeiro contato segue AIDA (Atenção → Interesse → Desejo → Ação)?
- [ ] O primeiro parágrafo prende atenção?
- [ ] Existe apenas **um** benefício principal?
- [ ] Existe apenas **um** CTA?
- [ ] O follow-up acrescenta uma informação nova em relação ao anterior?
- [ ] Não há repetição da mensagem anterior?
- [ ] O texto parece uma conversa real?
- [ ] A mensagem continua natural quando lida em voz alta?