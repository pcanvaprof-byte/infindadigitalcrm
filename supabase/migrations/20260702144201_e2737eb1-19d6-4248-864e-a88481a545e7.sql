
INSERT INTO public.cad_template_packs (pack_key, nome, descricao, categoria, icon, is_system, organization_id)
SELECT 'empresas_novas', 'Empresas Recém-abertas', 'Abordagem para empresas com CNPJ recente — foco em presença digital inicial.', 'nicho', 'Sparkles', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.cad_template_packs WHERE pack_key='empresas_novas' AND organization_id IS NULL);

INSERT INTO public.cad_templates (pack_key, stage, titulo, corpo, is_system, organization_id)
SELECT * FROM (VALUES
('empresas_novas'::text, 'followup_1'::public.cad_stage, 'Follow-up 1 — Empresa recém-aberta',
E'Olá {{responsavel}}, vi que a {{empresa}} foi aberta recentemente. Parabéns pela nova fase! 🎉\nPercebi que muitas empresas novas acabam perdendo oportunidades por ainda não terem uma presença profissional na internet.\n\nEu ajudo negócios a terem um site moderno que transmite confiança e gera contatos desde os primeiros meses de operação.\n\nPosso te mostrar alguns exemplos e fazer uma análise gratuita da sua presença digital?', true, NULL::uuid),
('empresas_novas', 'followup_2', 'Follow-up 2 — Diagnóstico gratuito',
E'Oi {{responsavel}}! Tudo bem? Aqui é da INFINDA Digital 👋\nDei uma olhada na {{empresa}} e percebi que dá pra aumentar bastante a visibilidade online com algumas mudanças simples — site profissional, Google Meu Negócio e captação de contatos.\n\nMontei um diagnóstico rápido e gratuito da presença digital da sua empresa. Posso te mandar por aqui mesmo?', true, NULL),
('empresas_novas', 'followup_3', 'Follow-up 3 — Aparecer no Google',
E'Olá {{responsavel}}! 🙌 Estou ajudando empresas da sua região a aparecerem mais no Google e a converter mais clientes pela internet.\n\nNotei alguns pontos na {{empresa}} que podem render bons resultados em pouco tempo (site, redes e tráfego). Te interessa receber uma análise gratuita com sugestões práticas, sem compromisso?', true, NULL)
) v(pack_key, stage, titulo, corpo, is_system, organization_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cad_templates t
  WHERE t.pack_key = v.pack_key AND t.stage = v.stage AND t.organization_id IS NULL
);

INSERT INTO public.cad_templates (pack_key, stage, titulo, corpo, is_system, organization_id)
SELECT 'empresas_novas', stage, titulo, corpo, true, NULL
  FROM public.cad_templates
 WHERE is_system AND pack_key='wa_padrao' AND organization_id IS NULL
   AND stage::text NOT IN ('followup_1','followup_2','followup_3')
   AND NOT EXISTS (
     SELECT 1 FROM public.cad_templates t2
     WHERE t2.pack_key='empresas_novas' AND t2.stage = cad_templates.stage AND t2.organization_id IS NULL
   );
