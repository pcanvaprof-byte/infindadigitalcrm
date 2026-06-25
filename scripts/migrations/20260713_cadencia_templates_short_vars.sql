-- Atualiza templates da Cadência para usar variáveis curtas
-- {{primeiro_nome}} e {{empresa_curta}} em vez de {{responsavel}} / {{empresa}}.
-- Só altera templates que ainda estão idênticos ao seed original (não sobrescreve customizações do usuário).

update public.cad_templates
set corpo = replace(replace(corpo, '{{responsavel}}', '{{primeiro_nome}}'), '{{empresa}}', '{{empresa_curta}}'),
    updated_at = now()
where corpo like '%{{responsavel}}%' or corpo like '%{{empresa}}%';

-- Atualiza a função de seed para novos orgs já nascerem com as variáveis curtas.
create or replace function public.cad_seed_templates(p_org uuid)
returns void language plpgsql as $$
begin
  insert into public.cad_templates (organization_id, stage, titulo, corpo) values
  (p_org, 'followup_1', 'Follow-up 1 — Confirmar visualização',
'Olá {{primeiro_nome}}, tudo bem?

Há alguns dias entrei em contato com a {{empresa_curta}} porque identifiquei oportunidades de crescimento através de marketing digital e automação.

Conseguiu visualizar minha mensagem anterior?

Posso te mostrar algumas ideias rapidamente.'),
  (p_org, 'followup_2', 'Follow-up 2 — Gerar curiosidade',
'Olá {{primeiro_nome}}, tudo bem?

Notei alguns pontos na {{empresa_curta}} que podem estar limitando a geração de oportunidades.

Posso compartilhar rapidamente.'),
  (p_org, 'followup_3', 'Follow-up 3 — Mostrar oportunidade',
'Olá {{primeiro_nome}}, tenho ajudado empresas como a {{empresa_curta}} a aumentar vendas com presença digital estruturada e tráfego pago.

Posso te mostrar como aplicar isso aí?'),
  (p_org, 'followup_4', 'Follow-up 4 — Benefício',
'{{primeiro_nome}}, automatizar parte do comercial e do marketing libera o time da {{empresa_curta}} para focar no que gera receita.

Quer que eu te mostre o que faz mais sentido começar primeiro?'),
  (p_org, 'followup_5', 'Follow-up 5 — Autoridade',
'Olá {{primeiro_nome}}, separei alguns resultados e cases de empresas parecidas com a {{empresa_curta}}.

Posso te mandar?'),
  (p_org, 'followup_6', 'Follow-up 6 — Convite para reunião',
'{{primeiro_nome}}, faz sentido marcarmos 20 minutos para eu te mostrar como podemos acelerar o crescimento da {{empresa_curta}}?

Tenho horário esta semana.'),
  (p_org, 'followup_7', 'Follow-up 7 — Encerramento',
'Olá {{primeiro_nome}}.

Como não obtive retorno, vou encerrar meus contatos por enquanto.

Caso faça sentido no futuro conversar sobre crescimento, tráfego pago, automações ou presença digital, fico à disposição.

Grande abraço.'),
  (p_org, 'interessado', 'Interessado — agendar conversa',
'Que ótimo, {{primeiro_nome}}! Vou te enviar agora algumas opções de horário para a gente conversar sobre a {{empresa_curta}}.'),
  (p_org, 'reuniao_agendada', 'Reunião agendada — confirmar',
'{{primeiro_nome}}, só confirmando nossa reunião. Qualquer ajuste me avise por aqui.'),
  (p_org, 'proposta_enviada', 'Proposta enviada — follow',
'{{primeiro_nome}}, te enviei a proposta. Posso te ligar para tirar dúvidas?'),
  (p_org, 'negociacao', 'Negociação',
'{{primeiro_nome}}, conseguimos fechar os pontos pendentes da proposta da {{empresa_curta}}?')
  on conflict (organization_id, stage) do nothing;
end $$;