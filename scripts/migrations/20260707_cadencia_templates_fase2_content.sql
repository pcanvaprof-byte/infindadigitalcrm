-- Fase 2 — Revisão de conteúdo dos 10 packs prioritários de cad_templates.
-- Regras: UPDATE-only, preserva id/pack_key/stage/is_system. Rollback via versionamento git.
-- Guia aplicado: docs/prospeccao/STYLE_GUIDE.md
BEGIN;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Passei aqui rápido pra te apresentar uma ideia pra {{empresa_curta}}.

Temos ajudado empresas parecidas a organizar o atendimento no WhatsApp e a aparecer melhor no Google, sem inchar o time.

Faz sentido eu te mandar um resumo curto de 1 minuto pra você olhar quando puder?', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, retomando o toque anterior.

O que te ajudaria mais agora na {{empresa_curta}}: aparecer melhor no Google, organizar o WhatsApp ou fechar mais orçamentos?

Me diz qual e eu foco só nisso.', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, sei que a rotina aperta. Só uma pergunta rápida: você olharia um exemplo de 30 segundos de como outra empresa parecida com a {{empresa_curta}} está fechando mais pelo WhatsApp?', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, um cliente do mesmo porte da {{empresa_curta}} dobrou o volume de contatos em 45 dias com uma mudança simples na página e no fluxo do WhatsApp.

Quer que eu te conte em duas linhas o que ele fez de diferente?', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, talvez o WhatsApp não seja o melhor canal pra falarmos disso.

Prefere que eu te mande por e-mail ou marcamos 10 min de ligação nesta semana? Me diz o que funciona melhor pra você.', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, pergunta direta: melhorar presença digital e vendas online é prioridade pra {{empresa_curta}} nos próximos 60 dias?

Se sim, eu bloqueio 15 min pra te mostrar. Se não é o momento, sem problema — só me sinaliza.', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, encerro por aqui pra não te incomodar mais.

Deixo meu contato salvo — quando fizer sentido conversar sobre crescimento da {{empresa_curta}}, é só me chamar. Sucesso.', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Que bom, {{primeiro_nome}}! Pra eu preparar algo objetivo pra {{empresa_curta}}, me conta rapidinho: o que você mais quer resolver primeiro?', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Fechado, {{primeiro_nome}}! Reunião confirmada. Vou te mandar o link 15 min antes. Se surgir imprevisto, me avisa por aqui que remarcamos sem problema.', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te enviei a proposta da {{empresa_curta}}. ✅

Quer olhar comigo em 10 min ou prefere revisar sozinho e me chamar depois?', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que precisa mudar na proposta pra fazer sentido pra {{empresa_curta}}? Prazo, valor ou escopo — me diz aberto que eu vejo o que consigo ajustar.', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Seja bem-vindo(a), {{primeiro_nome}}! 🚀 Muito feliz com a {{empresa_curta}} com a gente. Em breve te chamo com os próximos passos e o time responsável.', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Agradeço a atenção e desejo muito sucesso pra {{empresa_curta}}. Quando fizer sentido retomar, é só me chamar por aqui.', updated_at = now() WHERE pack_key = 'wa_padrao' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Vi a {{empresa_curta}} por aqui e resolvi te chamar direto.

Trabalho com empresas parecidas ajudando a transformar contatos do WhatsApp em orçamentos fechados, sem depender de sorte no marketing.

Te interessa eu te mandar um resumo de 1 minuto do que costuma funcionar melhor pro seu segmento?', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, retomando o primeiro contato. Sem pressa — só quero entender se faz sentido pra {{empresa_curta}} agora.

O que te ajudaria mais nas próximas semanas: aumentar o volume de contatos, converter melhor os que já chegam ou automatizar o atendimento?', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tenho um mini-case de 1 minuto de um cliente do mesmo porte da {{empresa_curta}} que pode ser útil.

Quer que eu te mande aqui pra você olhar quando tiver 30 segundos?', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, uma coisa simples que a gente costuma ajustar no primeiro mês já traz retorno claro: fluxo do WhatsApp, página de contato e captação.

Quer que eu te mostre em 15 min como isso ficaria pra {{empresa_curta}}?', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, talvez o WhatsApp não seja o melhor canal pra você agora. Prefere e-mail ou uma ligação rápida?

Me diz o que funciona melhor que eu te procuro por lá.', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, uma pergunta objetiva: crescer o comercial da {{empresa_curta}} está na sua lista de prioridades pros próximos 60 dias?

Se sim, marco 15 min contigo. Se não, sem problema — me sinaliza que eu paro por aqui.', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, entendo que talvez não seja o momento. Vou parar de te procurar pra não incomodar.

Deixo meu contato salvo — quando quiser retomar, é só me chamar. Sucesso pra {{empresa_curta}}.', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Ótimo, {{primeiro_nome}}! Pra eu preparar uma conversa útil pra {{empresa_curta}}, me conta em uma linha: o que você mais quer resolver primeiro?', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Confirmado, {{primeiro_nome}}! Vou te mandar o link 15 min antes da reunião. Qualquer imprevisto, me avisa por aqui e remarcamos.', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, proposta enviada. ✅ Prefere que eu te ligue pra explicar em 10 min ou você olha primeiro e me diz as dúvidas?', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, me diz aberto: o que precisa mudar pra fechar? Prazo, valor, escopo — vejo o que consigo ajustar.', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Bem-vindo(a), {{primeiro_nome}}! 🚀 Feliz com a {{empresa_curta}} do nosso lado. Já estou preparando o onboarding e em breve te chamo.', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Obrigado pela atenção — sucesso pra {{empresa_curta}}. Quando fizer sentido retomar, é só me chamar.', updated_at = now() WHERE pack_key = 'primeiro_contato' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Estou retomando nossa conversa sobre a {{empresa_curta}}.

Sem pressão — só quero entender se ainda faz sentido a gente falar ou se você prefere que eu volte a procurar mais pra frente.

O que é melhor pra você?', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, seguindo o toque anterior.

Se fosse pra resolver uma coisa só na {{empresa_curta}} nas próximas semanas, o que estaria no topo da sua lista? Talvez consiga te ajudar direto nisso.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, sei que a rotina aperta. Pergunta rápida: o assunto que a gente conversou continua no seu radar ou perdeu prioridade?

Me diz aberto que eu me ajusto.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, um cliente com contexto parecido com a {{empresa_curta}} teve um ganho concreto em 30 dias com uma mudança simples.

Quer que eu te mande o resumo em duas linhas?', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, talvez o WhatsApp esteja lotado. Prefere que eu te mande por e-mail ou marcamos 10 min de ligação?', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, pergunta objetiva: esse assunto entra ou não na prioridade da {{empresa_curta}} pros próximos 60 dias?

Se sim, marco 15 min. Se não, me sinaliza que paro por aqui.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, sem retorno vou encerrar por aqui pra não te incomodar mais.

Meu contato fica salvo — quando quiser retomar sobre a {{empresa_curta}}, é só chamar.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Ótimo, {{primeiro_nome}}! Me passa 2 ou 3 horários bons esta semana que eu já bloqueio uma conversa objetiva sobre a {{empresa_curta}}.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Fechado, {{primeiro_nome}}! Confirmada. Te mando o link 15 min antes; qualquer imprevisto, me avisa que remarcamos.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te enviei a proposta. Prefere revisar comigo em 10 min ou olhar primeiro e me chamar com as dúvidas?', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, me diz o que trava: prazo, valor ou escopo? Ajusto o que der pra fazer sentido pra {{empresa_curta}}.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Muito bom, {{primeiro_nome}}! 🚀 Bem-vindo(a). Em breve te procuro com os próximos passos do onboarding.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo bem, {{primeiro_nome}}. Obrigado pelo retorno — sucesso pra {{empresa_curta}}. Fica meu contato caso mude o cenário.', updated_at = now() WHERE pack_key = 'follow_up_universal' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, quanto tempo! Passei aqui pra dar um oi e entender como estão as coisas na {{empresa_curta}}.

Da última vez a gente chegou a conversar, mas não fechou. De lá pra cá mudou bastante coisa do nosso lado — e talvez faça mais sentido agora.

Vale eu te mandar um resumo curto do que mudou pra você decidir se topa retomar?', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, retomando o toque de ontem. Sem pressa — o que faria você reabrir essa conversa: prova de resultado, condição comercial ou uma prioridade específica da {{empresa_curta}} que eu não conheço?', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tenho um mini-case recente de um cliente parecido com a {{empresa_curta}} que pode ser útil pra você decidir se vale continuar. Quer que eu te mande?', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, uma coisa que costumo esquecer: o cenário do seu lado pode ter mudado. O que hoje é prioridade na {{empresa_curta}} que não era antes?', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, talvez WhatsApp não seja o melhor canal pra retomar. Prefere e-mail ou uma ligação rápida esta semana?', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, direto: faz sentido eu voltar a te procurar sobre esse tema ou é melhor eu encerrar por aqui?', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, entendo que o momento pode não ser agora. Encerro por aqui pra não te incomodar.

Deixo o contato salvo — quando fizer sentido retomar, chama.', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Que bom retomar, {{primeiro_nome}}! Pra eu preparar algo útil pra {{empresa_curta}}, me conta em uma linha o que mudou desde a última vez.', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Fechado, {{primeiro_nome}}! Confirmada. Link vai 15 min antes; imprevisto, me chama.', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te reenviei a proposta ajustada ao cenário atual da {{empresa_curta}}. Quer olhar comigo ou revisa primeiro e me chama?', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que trava agora? Se for prazo, valor ou escopo, me diz aberto que ajusto o que der.', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Muito bom voltar a trabalhar juntos, {{primeiro_nome}}! 🚀 Já preparo o onboarding e te chamo com os próximos passos.', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Obrigado por retomar — sucesso pra {{empresa_curta}}. Fica meu contato pra quando fizer sentido.', updated_at = now() WHERE pack_key = 'reativacao' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Vi que a {{empresa_curta}} começou faz pouco — parabéns pela nova fase.

Essa etapa costuma pesar em duas coisas: aparecer pros clientes certos e organizar o atendimento sem depender só de mensagem manual.

Te interessa eu te mostrar em 3 minutos como outras empresas recém-abertas estão resolvendo isso desde o início?
---
{{primeiro_nome}}, tudo bem? Passei aqui rápido porque vi que a {{empresa_curta}} é recente.

Ajudamos empresas na fase inicial a montar presença profissional no WhatsApp e no Google sem complicar a rotina — e sem custo alto de começo.

Faz sentido eu te mandar um resumo curto pra você olhar quando puder?
---
Olá {{primeiro_nome}}, notei que a {{empresa_curta}} está começando agora.

O que costuma acelerar essa fase é ter um catálogo organizado no WhatsApp, aparecer no Google Meu Negócio e não perder contato quando o movimento aumenta.

Quer que eu te mostre em 5 min como isso funciona?
---
{{primeiro_nome}}, tudo bem? Parabéns pela abertura da {{empresa_curta}}.

Trabalho com empresas nesse mesmo momento de arranque, ajudando a evitar o retrabalho típico do começo: atendimento perdido, orçamento sem retorno, presença digital confusa.

Posso te mostrar em poucos minutos como a gente resolve isso?
---
Oi {{primeiro_nome}}, espero que o início da {{empresa_curta}} esteja indo bem.

A gente ajuda negócios novos a se apresentarem de forma profissional pelo WhatsApp — catálogo organizado, respostas rápidas e mais conversão desde o dia um.

Consegue 3 minutos pra eu te mostrar?', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, seguindo o toque anterior.

O que faria mais diferença agora pra {{empresa_curta}}: aparecer mais no Google, organizar o WhatsApp ou não perder contato que já chega?

Me diz qual e eu foco só nisso.', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, empresas na mesma fase da {{empresa_curta}} costumam ganhar tempo com três coisas simples: Google Meu Negócio bem preenchido, um catálogo digital e um fluxo básico de resposta no WhatsApp.

Quer que eu te mande um checklist rápido pra você olhar?', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, ajudamos recentemente uma empresa parecida com a {{empresa_curta}} a organizar isso nas primeiras semanas de operação.

Quer que eu te mande o resumo em 30 segundos de leitura?', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, talvez WhatsApp esteja lotado nesta fase. Prefere que eu te mande por e-mail ou marcamos 10 min de ligação esta semana?', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, pergunta direta: organizar presença digital e atendimento entra na prioridade da {{empresa_curta}} pros próximos 60 dias?

Se sim, marco 15 min contigo. Se não é agora, sem problema — só me sinaliza.', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, encerro por aqui pra não te incomodar.

Muito sucesso nesta primeira fase da {{empresa_curta}} — quando fizer sentido conversar, é só me chamar.', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Que bom, {{primeiro_nome}}! Pra eu preparar uma conversa objetiva sobre a {{empresa_curta}}, me conta em uma linha: o que é mais urgente agora?', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Confirmado, {{primeiro_nome}}! Vou te mandar o link 15 min antes. Qualquer imprevisto, me avisa que remarcamos sem dor de cabeça.', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te enviei a proposta da {{empresa_curta}}. ✅ Quer olhar comigo em 10 min ou prefere revisar primeiro?', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que falta pra fazer sentido pra {{empresa_curta}}? Prazo, condição ou escopo — me diz aberto que ajusto o que der.', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Bem-vindo(a), {{primeiro_nome}}! 🚀 Muito feliz de acompanhar a {{empresa_curta}} desde o início. Em breve te chamo com o onboarding.', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Sucesso pra {{empresa_curta}} — deixo meu contato pra quando fizer sentido retomar.', updated_at = now() WHERE pack_key = 'empresas_novas' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Passei aqui rápido pra falar da {{empresa_curta}}.

Ajudamos restaurantes e deliveries a receber pedidos direto pelo WhatsApp com cardápio digital, sem depender só das plataformas que cobram 20% ou mais.

Faz sentido eu te mostrar em 3 minutos como funciona pro seu tipo de operação?', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, seguindo o toque anterior. O que hoje aperta mais na {{empresa_curta}}: taxa de aplicativo, pedido que se perde no chat ou cliente que só pede uma vez e não volta?

Me diz qual dói mais que eu foco só nisso.', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, um restaurante do porte parecido com a {{empresa_curta}} reduziu 40% da taxa de app trazendo os pedidos recorrentes pro WhatsApp.

Quer que eu te mande o resumo em duas linhas?', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, cardápio digital bem feito + fluxo de resposta no WhatsApp costuma virar o jogo em 60 dias.

Posso te mostrar em 10 min como ficaria pra {{empresa_curta}}?', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, sei que a rotina de restaurante é corrida. Prefere que eu te mande por e-mail ou marco 10 min de ligação num horário fora do pico?', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, direto: reduzir dependência de app e vender mais pelo próprio WhatsApp é prioridade pra {{empresa_curta}} nos próximos 60 dias?

Se sim, marco 15 min. Se não é agora, me sinaliza.', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, encerro por aqui pra não te incomodar. Deixo o contato salvo — quando fizer sentido conversar sobre delivery direto, chama. Sucesso pra {{empresa_curta}}.', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Ótimo, {{primeiro_nome}}! Pra eu preparar algo útil pra {{empresa_curta}}, me conta rapidinho: hoje a maior parte dos pedidos vem de app, WhatsApp ou balcão?', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Confirmado, {{primeiro_nome}}! Link vai 15 min antes. Qualquer imprevisto no salão, me avisa por aqui.', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te enviei a proposta da {{empresa_curta}}. ✅ Prefere revisar comigo em 10 min ou olhar sozinho e me chamar depois?', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que trava agora? Prazo, valor ou escopo — me diz aberto que vejo o que ajusto pra fazer sentido pra {{empresa_curta}}.', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Bem-vindo(a), {{primeiro_nome}}! 🚀 Vamos deixar o delivery da {{empresa_curta}} redondo. Em breve te chamo com o onboarding.', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Sucesso pra {{empresa_curta}} — quando quiser retomar, é só me chamar.', updated_at = now() WHERE pack_key = 'restaurante_delivery' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Passei aqui pra falar rápido sobre a {{empresa_curta}}.

Ajudamos clínicas a organizar agendamento e confirmação de consultas pelo WhatsApp, reduzindo falta e liberando a secretária pra atender melhor quem chega.

Faz sentido eu te mostrar em 5 min como funciona pra sua rotina?', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, seguindo o toque anterior. O que hoje mais pesa na {{empresa_curta}}: cadeira vazia por falta, agenda desorganizada ou paciente que some depois da primeira consulta?

Me diz qual mais dói.', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, uma clínica parecida com a {{empresa_curta}} reduziu quase pela metade a taxa de falta com um fluxo simples de confirmação no WhatsApp.

Quer que eu te mande o resumo em duas linhas?', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, além de reduzir falta, dá pra reativar paciente antigo com mensagem certa na hora certa — sem parecer robô.

Posso te mostrar em 10 min como isso ficaria pra {{empresa_curta}}?', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, sei que entre atendimentos é difícil parar. Prefere e-mail ou uma ligação rápida no fim do expediente?', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, direto: reduzir falta e organizar o agendamento da {{empresa_curta}} entra na prioridade dos próximos 60 dias?

Se sim, marco 15 min. Se não, me sinaliza que paro por aqui.', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, encerro por aqui pra não te incomodar. Muito sucesso pra {{empresa_curta}} — quando fizer sentido retomar, chama.', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Que bom, {{primeiro_nome}}! Pra eu preparar uma conversa útil pra {{empresa_curta}}, me conta em uma linha: qual é o maior gargalo da agenda hoje?', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Confirmado, {{primeiro_nome}}! Link vai 15 min antes. Qualquer imprevisto no consultório, me avisa que remarcamos.', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te enviei a proposta da {{empresa_curta}}. ✅ Prefere revisar comigo ou olhar primeiro e me chamar?', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que falta pra fechar? Prazo, valor ou escopo — me diz aberto que ajusto o que der.', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Bem-vindo(a), {{primeiro_nome}}! 🚀 Vamos deixar a agenda da {{empresa_curta}} muito mais leve. Em breve te chamo com o onboarding.', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Sucesso pra {{empresa_curta}} — meu contato fica salvo pra quando fizer sentido retomar.', updated_at = now() WHERE pack_key = 'saude_clinicas' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Passei aqui rápido pra falar da {{empresa_curta}}.

Ajudamos clínicas odontológicas a lotar a agenda com fluxo simples no WhatsApp: confirmação automática, reativação de paciente antigo e captação pelo Google.

Faz sentido eu te mostrar em 5 min como isso funciona pra sua rotina?', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, seguindo o toque anterior. O que mais pesa hoje na {{empresa_curta}}: cadeira vazia, retorno que não acontece ou dificuldade de trazer paciente novo?

Me diz qual dói mais.', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, uma clínica do mesmo perfil da {{empresa_curta}} recuperou dezenas de pacientes antigos com uma sequência simples de mensagens.

Quer que eu te mande o resumo em duas linhas?', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, com uma agenda cheia e taxa de falta baixa, o faturamento por cadeira sobe bastante — sem contratar mais gente.

Posso te mostrar em 10 min como ficaria pra {{empresa_curta}}?', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, sei que entre pacientes é corrido. Prefere e-mail ou uma ligação rápida no fim do dia?', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, direto: lotar a agenda e reduzir faltas na {{empresa_curta}} está na prioridade dos próximos 60 dias?

Se sim, marco 15 min. Se não, me sinaliza.', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, encerro por aqui pra não te incomodar. Muito sucesso pra {{empresa_curta}} — quando quiser retomar, chama.', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Ótimo, {{primeiro_nome}}! Pra eu preparar algo útil pra {{empresa_curta}}, me conta em uma linha: qual é o maior gargalo hoje — captação, retorno ou falta?', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Confirmado, {{primeiro_nome}}! Link vai 15 min antes. Qualquer imprevisto na clínica, me avisa por aqui.', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te enviei a proposta da {{empresa_curta}}. ✅ Prefere revisar comigo em 10 min ou olhar primeiro?', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que falta pra fechar? Prazo, condição ou escopo — me diz aberto que ajusto.', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Bem-vindo(a), {{primeiro_nome}}! 🚀 Vamos deixar a agenda da {{empresa_curta}} muito mais cheia. Em breve te chamo com o onboarding.', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Sucesso pra {{empresa_curta}} — meu contato fica salvo.', updated_at = now() WHERE pack_key = 'odontologia' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Passei aqui rápido pra falar da {{empresa_curta}}.

Ajudamos clínicas de estética a lotar a agenda com fluxo simples no WhatsApp: reativação de cliente, pacotes recorrentes e captação pelo Instagram e Google.

Faz sentido eu te mostrar em 5 min como isso funciona pra sua rotina?', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, seguindo o toque anterior. O que hoje mais aperta na {{empresa_curta}}: cabine vaga em dia fraco, cliente que faz uma vez e some ou dificuldade de vender pacote?

Me diz qual dói mais.', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, uma clínica parecida com a {{empresa_curta}} triplicou a venda de pacotes com uma mudança simples na abordagem de retorno.

Quer que eu te mande o resumo em duas linhas?', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o segredo costuma estar em três coisas: reativação certa, foto/vídeo bem feito e resposta rápida no WhatsApp.

Posso te mostrar em 10 min como ficaria pra {{empresa_curta}}?', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, sei que dia de atendimento é corrido. Prefere e-mail ou uma ligação rápida no fim do dia?', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, direto: lotar a agenda e vender mais pacote na {{empresa_curta}} está na prioridade dos próximos 60 dias?

Se sim, marco 15 min. Se não, me sinaliza.', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, encerro por aqui pra não te incomodar. Muito sucesso pra {{empresa_curta}} — quando fizer sentido retomar, chama.', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Ótimo, {{primeiro_nome}}! Pra eu preparar algo útil pra {{empresa_curta}}, me conta em uma linha: qual serviço tem mais margem e você quer vender mais?', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Confirmado, {{primeiro_nome}}! Link vai 15 min antes. Qualquer imprevisto na cabine, me avisa por aqui.', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te enviei a proposta da {{empresa_curta}}. ✅ Prefere revisar comigo ou olhar primeiro e me chamar?', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que falta pra fechar? Prazo, condição ou escopo — me diz aberto que ajusto.', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Bem-vindo(a), {{primeiro_nome}}! 🚀 Vamos deixar a agenda da {{empresa_curta}} muito mais cheia. Em breve te chamo com o onboarding.', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Sucesso pra {{empresa_curta}} — meu contato fica salvo.', updated_at = now() WHERE pack_key = 'estetica' AND stage = 'perdido' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, tudo bem? Passei aqui rápido pra falar da {{empresa_curta}}.

Ajudamos barbearias a encher a cadeira em dia fraco: agendamento pelo WhatsApp, lembrete automático e reativação de cliente que sumiu.

Faz sentido eu te mostrar em 5 min como isso funciona pra sua rotina?', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'followup_1' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, seguindo o toque anterior. O que mais aperta hoje na {{empresa_curta}}: cadeira vazia de terça a quinta, cliente que só volta quando lembra ou agenda desorganizada?

Me diz qual dói mais.', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'followup_2' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Oi {{primeiro_nome}}, uma barbearia parecida com a {{empresa_curta}} passou a lotar terça e quarta só com lembrete e reativação bem feita no WhatsApp.

Quer que eu te mande o resumo em duas linhas?', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'followup_3' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que costuma virar o jogo pra barbearia é combinar três coisas simples: agendamento sem fricção, lembrete de retorno e resposta rápida no WhatsApp.

Posso te mostrar em 10 min como ficaria pra {{empresa_curta}}?', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'followup_4' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, sei que dia de movimento é corrido. Prefere e-mail ou uma ligação rápida num horário fora do pico?', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'followup_5' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, direto: encher a agenda de terça a quinta na {{empresa_curta}} está na prioridade dos próximos 60 dias?

Se sim, marco 15 min. Se não, me sinaliza.', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'followup_6' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, encerro por aqui pra não te incomodar. Muito sucesso pra {{empresa_curta}} — quando fizer sentido retomar, chama.', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'followup_7' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Ótimo, {{primeiro_nome}}! Pra eu preparar algo útil pra {{empresa_curta}}, me conta em uma linha: qual dia da semana precisa mais de gente na cadeira?', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'interessado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Confirmado, {{primeiro_nome}}! Link vai 15 min antes. Qualquer imprevisto, me avisa por aqui.', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'reuniao_agendada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, te enviei a proposta da {{empresa_curta}}. ✅ Prefere revisar comigo ou olhar primeiro?', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'proposta_enviada' AND is_system = true;
UPDATE public.cad_templates SET corpo = '{{primeiro_nome}}, o que falta pra fechar? Prazo, condição ou escopo — me diz aberto que ajusto.', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'negociacao' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Bem-vindo(a), {{primeiro_nome}}! 🚀 Vamos deixar a agenda da {{empresa_curta}} muito mais cheia. Em breve te chamo com o onboarding.', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'fechado' AND is_system = true;
UPDATE public.cad_templates SET corpo = 'Tudo certo, {{primeiro_nome}}. Sucesso pra {{empresa_curta}} — meu contato fica salvo.', updated_at = now() WHERE pack_key = 'barbearia' AND stage = 'perdido' AND is_system = true;
COMMIT;
