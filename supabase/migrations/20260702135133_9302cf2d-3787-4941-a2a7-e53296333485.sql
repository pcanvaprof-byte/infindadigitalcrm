
ALTER TABLE public.cad_templates
  ADD COLUMN IF NOT EXISTS pack_key TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.cad_templates DROP CONSTRAINT IF EXISTS cad_templates_organization_id_stage_key;
ALTER TABLE public.cad_templates ALTER COLUMN organization_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cad_templates_org_pack_stage_uk
  ON public.cad_templates (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), pack_key, stage);

CREATE TABLE IF NOT EXISTS public.cad_template_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_key TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'nicho',
  icon TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cad_template_packs TO authenticated;
GRANT ALL ON public.cad_template_packs TO service_role;
ALTER TABLE public.cad_template_packs ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS cad_template_packs_scope_uk
  ON public.cad_template_packs (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), pack_key);

DROP POLICY IF EXISTS "packs_read_all" ON public.cad_template_packs;
CREATE POLICY "packs_read_all" ON public.cad_template_packs
  FOR SELECT TO authenticated
  USING (is_system OR organization_id = public.current_org_id());

DROP POLICY IF EXISTS "packs_write_own" ON public.cad_template_packs;
CREATE POLICY "packs_write_own" ON public.cad_template_packs
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND NOT is_system)
  WITH CHECK (organization_id = public.current_org_id() AND NOT is_system);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS active_template_pack TEXT NOT NULL DEFAULT 'default';

DROP POLICY IF EXISTS "cad_templates_read" ON public.cad_templates;
CREATE POLICY "cad_templates_read" ON public.cad_templates
  FOR SELECT TO authenticated
  USING (is_system OR organization_id = public.current_org_id());

DROP POLICY IF EXISTS "cad_templates_write" ON public.cad_templates;
CREATE POLICY "cad_templates_write" ON public.cad_templates
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND NOT is_system)
  WITH CHECK (organization_id = public.current_org_id() AND NOT is_system);

INSERT INTO public.cad_template_packs (pack_key, nome, descricao, categoria, icon, is_system) VALUES
  ('default',     'Geral',                    'Templates padrão para qualquer segmento',        'geral',         'Megaphone',        true),
  ('restaurante', 'Restaurantes',             'Cadência para restaurantes, bares e delivery',   'nicho',         'UtensilsCrossed',  true),
  ('dentista',    'Dia do Dentista (25/10)',  'Homenagem + oferta para clínicas odontológicas', 'data_especial', 'Smile',            true),
  ('contador',    'Dia do Contador (22/09)',  'Homenagem + oferta para escritórios contábeis',  'data_especial', 'Calculator',       true),
  ('medico',      'Dia do Médico (18/10)',    'Homenagem + oferta para clínicas médicas',       'data_especial', 'Stethoscope',      true),
  ('advogado',    'Dia do Advogado (11/08)',  'Homenagem + oferta para escritórios jurídicos',  'data_especial', 'Scale',            true),
  ('professor',   'Dia do Professor (15/10)', 'Homenagem + oferta para escolas e cursos',       'data_especial', 'GraduationCap',    true),
  ('secretaria',  'Dia da Secretária (30/09)','Homenagem para equipes administrativas',         'data_especial', 'ClipboardList',    true)
ON CONFLICT DO NOTHING;

INSERT INTO public.cad_templates (organization_id, pack_key, stage, titulo, corpo, is_system) VALUES
  (NULL,'restaurante','followup_1','R1 · Primeiro toque',
   E'Oi {{contato}}! Vi o {{empresa}} aqui em {{cidade}} — parabéns pela nota {{nota_google}} no Google 🙌\n\nTrabalho ajudando restaurantes a reduzir dependência de iFood e trazer clientes recorrentes pelo WhatsApp.\n\nFaz sentido a gente trocar 5 min essa semana?',true),
  (NULL,'restaurante','followup_2','R2 · Áudio curto (D+3)',
   E'{{contato}}, gravei um áudio rápido explicando como um restaurante parecido com o {{empresa}} aumentou 22% no ticket médio em 60 dias sem depender de app de delivery. Posso te mandar?',true),
  (NULL,'restaurante','followup_3','R3 · Case (D+7)',
   E'Oi {{contato}}, separei um case rápido de um restaurante em {{cidade}} que estava na mesma situação e hoje fatura +R$ 18k/mês só com programa de recorrência. Te mando o print?',true),
  (NULL,'restaurante','followup_4','R4 · Quebra de padrão (D+14)',
   E'{{contato}}, sei que restaurante é corrido — cozinha, salão, delivery, fornecedor atrasando 😅\n\nResumi tudo em 1 imagem: o que a gente faria nos primeiros 30 dias no {{empresa}}. Quer que eu envie?',true),
  (NULL,'restaurante','followup_5','R5 · Prova social local (D+21)',
   E'Oi {{contato}}, mais 2 restaurantes aqui de {{cidade}} entraram esse mês. Fecho a agenda em breve — quer garantir uma conversa antes?',true),
  (NULL,'restaurante','followup_6','R6 · Oferta específica (D+30)',
   E'{{contato}}, tenho uma condição especial pra restaurantes que fecharem até sexta: setup grátis + 30 dias de acompanhamento. Faz sentido pro {{empresa}}?',true),
  (NULL,'restaurante','followup_7','R7 · Break-up (D+45)',
   E'{{contato}}, vou encerrar seu contato por aqui pra não incomodar. Se um dia quiser retomar a conversa sobre reduzir dependência do iFood, é só chamar. Sucesso com o {{empresa}} 🙏',true),
  (NULL,'restaurante','interessado','R · Interessado',
   E'Show, {{contato}}! Bora marcar 20 min essa semana? Te mando 3 horários:\n\n• Ter 15h\n• Qua 16h30\n• Qui 10h\n\nQual encaixa melhor?',true),
  (NULL,'restaurante','reuniao_agendada','R · Reunião agendada',
   E'Confirmado, {{contato}}! Reunião do {{empresa}} marcada. Vou levar 2 exemplos de restaurantes parecidos e um plano específico pra vocês. Até lá 🚀',true),
  (NULL,'restaurante','proposta_enviada','R · Proposta enviada',
   E'{{contato}}, acabei de te enviar a proposta do {{empresa}} por e-mail e WhatsApp. Qualquer dúvida me chama. Combinamos de conversar {{data_retorno}}?',true),
  (NULL,'restaurante','negociacao','R · Negociação',
   E'{{contato}}, revisei aqui e consigo fazer um ajuste na proposta pra caber no orçamento do {{empresa}}. Posso te ligar 5 min agora pra fechar?',true),
  (NULL,'restaurante','fechado','R · Fechado 🎉',
   E'{{contato}}, bem-vindo(a) 🎉 Vou te encaminhar agora pro time de onboarding. Em 48h a gente já começa a rodar as primeiras ações no {{empresa}}. Bora crescer!',true),
  (NULL,'restaurante','perdido','R · Perdido (nutrição)',
   E'Tudo bem, {{contato}}! Vou te tirar da cadência ativa mas sigo por aqui. Toda quinta mando 1 dica curta pra restaurante — se quiser sair é só responder SAIR. Sucesso 🙏',true)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.cad_list_packs()
RETURNS TABLE (
  pack_key TEXT, nome TEXT, descricao TEXT, categoria TEXT, icon TEXT,
  is_system BOOLEAN, is_active BOOLEAN, template_count INTEGER
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID := public.current_org_id();
DECLARE _active TEXT;
BEGIN
  SELECT active_template_pack INTO _active FROM public.organizations WHERE id = _org;
  RETURN QUERY
  SELECT p.pack_key, p.nome, p.descricao, p.categoria, p.icon, p.is_system,
    (p.pack_key = COALESCE(_active,'default')) AS is_active,
    (SELECT COUNT(*)::INTEGER FROM public.cad_templates t
       WHERE t.pack_key = p.pack_key AND (t.is_system OR t.organization_id = _org))
  FROM public.cad_template_packs p
  WHERE p.is_system OR p.organization_id = _org
  ORDER BY p.is_system DESC, p.categoria, p.nome;
END; $$;
GRANT EXECUTE ON FUNCTION public.cad_list_packs() TO authenticated;

CREATE OR REPLACE FUNCTION public.cad_apply_pack(_pack_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID := public.current_org_id();
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'no active org'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cad_template_packs
    WHERE pack_key = _pack_key AND (is_system OR organization_id = _org))
  THEN RAISE EXCEPTION 'pack not found: %', _pack_key; END IF;
  UPDATE public.organizations SET active_template_pack = _pack_key WHERE id = _org;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.cad_apply_pack(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cad_create_custom_pack(
  _pack_key TEXT, _nome TEXT, _descricao TEXT DEFAULT NULL,
  _categoria TEXT DEFAULT 'custom', _icon TEXT DEFAULT 'Sparkles'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID := public.current_org_id(); _id UUID;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'no active org'; END IF;
  INSERT INTO public.cad_template_packs (pack_key, nome, descricao, categoria, icon, is_system, organization_id)
  VALUES (_pack_key, _nome, _descricao, _categoria, _icon, false, _org)
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.cad_create_custom_pack(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cad_resolve_template(_stage cad_stage)
RETURNS TABLE (titulo TEXT, corpo TEXT, pack_key TEXT, is_override BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID := public.current_org_id(); _active TEXT;
BEGIN
  SELECT active_template_pack INTO _active FROM public.organizations WHERE id = _org;
  _active := COALESCE(_active,'default');
  RETURN QUERY SELECT t.titulo, t.corpo, t.pack_key, true
    FROM public.cad_templates t
    WHERE t.organization_id = _org AND t.pack_key = _active AND t.stage = _stage LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT t.titulo, t.corpo, t.pack_key, false
    FROM public.cad_templates t
    WHERE t.is_system AND t.pack_key = _active AND t.stage = _stage LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT t.titulo, t.corpo, t.pack_key, true
    FROM public.cad_templates t
    WHERE t.organization_id = _org AND t.pack_key = 'default' AND t.stage = _stage LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT t.titulo, t.corpo, t.pack_key, false
    FROM public.cad_templates t
    WHERE t.is_system AND t.pack_key = 'default' AND t.stage = _stage LIMIT 1;
END; $$;
GRANT EXECUTE ON FUNCTION public.cad_resolve_template(cad_stage) TO authenticated;
