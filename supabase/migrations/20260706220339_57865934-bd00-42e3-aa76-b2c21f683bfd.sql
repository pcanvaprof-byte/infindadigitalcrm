
-- ===================== ENUMS =====================
DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM (
    'rascunho','enviada','visualizada','ajustes_solicitados',
    'aprovada','rejeitada','expirada','convertida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM (
    'nao_gerado','gerado','enviado','assinado','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cobranca_tipo AS ENUM ('implantacao','mensal','avulso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================== TOKEN HELPER =====================
CREATE OR REPLACE FUNCTION public.gen_proposal_token()
RETURNS text LANGUAGE sql SET search_path='public','extensions' AS $$
  SELECT translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_')
$$;

-- ===================== TABLES =====================
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid,
  deal_id uuid,
  client_id uuid,
  lead_id uuid,
  numero text NOT NULL UNIQUE,
  titulo text NOT NULL DEFAULT 'Proposta Comercial',
  status public.proposal_status NOT NULL DEFAULT 'rascunho',
  current_version_id uuid,
  valor_implantacao numeric(14,2) NOT NULL DEFAULT 0,
  valor_mensal numeric(14,2) NOT NULL DEFAULT 0,
  valor_avulso numeric(14,2) NOT NULL DEFAULT 0,
  desconto_pct numeric(5,2) NOT NULL DEFAULT 0,
  validade_dias integer NOT NULL DEFAULT 7,
  valid_until timestamptz,
  token_publico text NOT NULL UNIQUE DEFAULT public.gen_proposal_token(),
  pdf_url text,
  pdf_generated_at timestamptz,
  contract_status public.contract_status NOT NULL DEFAULT 'nao_gerado',
  motivo_perda text,
  motivo_aprovacao text,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  decided_at timestamptz,
  expired_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposals_owner_all ON public.proposals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_proposals_user ON public.proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);

-- Items
CREATE TABLE IF NOT EXISTS public.proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  catalog_item_id uuid,
  nome text NOT NULL,
  descricao text,
  categoria text,
  area text,
  cobranca public.cobranca_tipo NOT NULL DEFAULT 'implantacao',
  quantidade integer NOT NULL DEFAULT 1,
  valor_unitario numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  prazo_dias integer,
  entregaveis text[] NOT NULL DEFAULT ARRAY[]::text[],
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_items TO authenticated;
GRANT ALL ON public.proposal_items TO service_role;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_items_owner_all ON public.proposal_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_proposal_items_prop ON public.proposal_items(proposal_id);

-- Versions
CREATE TABLE IF NOT EXISTS public.proposal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  conteudo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_implantacao numeric(14,2) NOT NULL DEFAULT 0,
  valor_mensal numeric(14,2) NOT NULL DEFAULT 0,
  valor_avulso numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, version_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_versions TO authenticated;
GRANT ALL ON public.proposal_versions TO service_role;
ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_versions_owner_all ON public.proposal_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.user_id = auth.uid()));

-- Events (timeline)
CREATE TABLE IF NOT EXISTS public.proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_events TO authenticated;
GRANT ALL ON public.proposal_events TO service_role;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_events_owner_select ON public.proposal_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_proposal_events_prop ON public.proposal_events(proposal_id, created_at DESC);

-- Adjustments (pedidos do cliente + notas internas)
CREATE TABLE IF NOT EXISTS public.proposal_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  origem text NOT NULL CHECK (origem IN ('cliente','interno')),
  autor_nome text,
  autor_cargo text,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','resolvido','descartado')),
  resolvido_em timestamptz,
  resolvido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_adjustments TO authenticated;
GRANT ALL ON public.proposal_adjustments TO service_role;
ALTER TABLE public.proposal_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_adjustments_owner_all ON public.proposal_adjustments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_proposal_adj_prop ON public.proposal_adjustments(proposal_id, created_at DESC);

-- ===================== TRIGGERS =====================
CREATE OR REPLACE FUNCTION public._proposals_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_proposals_touch ON public.proposals;
CREATE TRIGGER trg_proposals_touch BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public._proposals_touch();

-- Recalc totals when items change
CREATE OR REPLACE FUNCTION public._proposals_recalc_from_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_prop uuid;
BEGIN
  v_prop := COALESCE(NEW.proposal_id, OLD.proposal_id);
  UPDATE public.proposals p SET
    valor_implantacao = COALESCE((SELECT SUM(valor_total) FROM public.proposal_items WHERE proposal_id = v_prop AND cobranca='implantacao'),0),
    valor_mensal      = COALESCE((SELECT SUM(valor_total) FROM public.proposal_items WHERE proposal_id = v_prop AND cobranca='mensal'),0),
    valor_avulso      = COALESCE((SELECT SUM(valor_total) FROM public.proposal_items WHERE proposal_id = v_prop AND cobranca='avulso'),0),
    updated_at = now()
  WHERE p.id = v_prop;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_proposal_items_recalc ON public.proposal_items;
CREATE TRIGGER trg_proposal_items_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.proposal_items
  FOR EACH ROW EXECUTE FUNCTION public._proposals_recalc_from_items();

-- Ensure valor_total = qtd * unitario
CREATE OR REPLACE FUNCTION public._proposal_items_set_total()
RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $$
BEGIN
  NEW.valor_total = COALESCE(NEW.quantidade,1) * COALESCE(NEW.valor_unitario,0);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proposal_items_total ON public.proposal_items;
CREATE TRIGGER trg_proposal_items_total BEFORE INSERT OR UPDATE ON public.proposal_items
  FOR EACH ROW EXECUTE FUNCTION public._proposal_items_set_total();

-- Numero auto (P-YYYYMM-####)
CREATE SEQUENCE IF NOT EXISTS public.proposal_numero_seq;

CREATE OR REPLACE FUNCTION public._proposals_set_numero()
RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero = 'P-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.proposal_numero_seq')::text, 4, '0');
  END IF;
  IF NEW.valid_until IS NULL AND NEW.validade_dias IS NOT NULL THEN
    NEW.valid_until = now() + (NEW.validade_dias || ' days')::interval;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proposals_set_numero ON public.proposals;
CREATE TRIGGER trg_proposals_set_numero BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public._proposals_set_numero();

-- ===================== RPCs =====================

-- Cria proposta a partir de deal/prospect/blank
CREATE OR REPLACE FUNCTION public.create_proposal_from_source(
  p_deal_id uuid, p_prospect_id uuid, p_titulo text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client uuid; v_lead uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  IF p_deal_id IS NOT NULL THEN
    SELECT client_id, prospect_id INTO v_client, v_lead
      FROM public.deals WHERE id = p_deal_id AND user_id = v_uid;
  ELSIF p_prospect_id IS NOT NULL THEN
    v_lead := p_prospect_id;
  END IF;

  INSERT INTO public.proposals(user_id, deal_id, client_id, lead_id, titulo, organization_id)
  VALUES (v_uid, p_deal_id, v_client, v_lead, COALESCE(NULLIF(p_titulo,''),'Proposta Comercial'),
          public.current_org_id())
  RETURNING id INTO v_id;

  -- versão inicial vazia
  INSERT INTO public.proposal_versions(proposal_id, version_number, conteudo_json)
  VALUES (v_id, 1, '{}'::jsonb);
  UPDATE public.proposals SET current_version_id = (
    SELECT id FROM public.proposal_versions WHERE proposal_id = v_id AND version_number = 1
  ) WHERE id = v_id;

  INSERT INTO public.proposal_events(proposal_id, event_type, actor_type, actor_id, payload)
  VALUES (v_id, 'criada', 'user', v_uid, jsonb_build_object('deal_id',p_deal_id,'prospect_id',p_prospect_id));

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_proposal_from_source(uuid,uuid,text) TO authenticated;

-- Nova versão
CREATE OR REPLACE FUNCTION public.create_proposal_version(
  p_proposal_id uuid, p_conteudo jsonb, p_observacoes text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_uid uuid := auth.uid(); v_next int; v_id uuid; v_prop public.proposals;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;

  SELECT COALESCE(MAX(version_number),0)+1 INTO v_next
    FROM public.proposal_versions WHERE proposal_id = p_proposal_id;

  INSERT INTO public.proposal_versions(proposal_id, version_number, conteudo_json,
    valor_implantacao, valor_mensal, valor_avulso, observacoes)
  VALUES (p_proposal_id, v_next, COALESCE(p_conteudo,'{}'::jsonb),
    v_prop.valor_implantacao, v_prop.valor_mensal, v_prop.valor_avulso, p_observacoes)
  RETURNING id INTO v_id;

  UPDATE public.proposals SET current_version_id = v_id, updated_at = now()
   WHERE id = p_proposal_id;

  INSERT INTO public.proposal_events(proposal_id, event_type, actor_type, actor_id, payload)
  VALUES (p_proposal_id, 'versao_criada', 'user', v_uid,
          jsonb_build_object('version_number', v_next));

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_proposal_version(uuid,jsonb,text) TO authenticated;

-- Registrar envio
CREATE OR REPLACE FUNCTION public.register_proposal_send(
  p_proposal_id uuid, p_canal text, p_destino text, p_mensagem text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  UPDATE public.proposals SET
    status = CASE WHEN status = 'rascunho' THEN 'enviada'::public.proposal_status ELSE status END,
    sent_at = COALESCE(sent_at, now()),
    updated_at = now()
   WHERE id = p_proposal_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;
  INSERT INTO public.proposal_events(proposal_id, event_type, actor_type, actor_id, payload)
  VALUES (p_proposal_id, 'enviada', 'user', v_uid,
    jsonb_build_object('canal',p_canal,'destino',p_destino,'mensagem',p_mensagem));
END $$;

GRANT EXECUTE ON FUNCTION public.register_proposal_send(uuid,text,text,text) TO authenticated;

-- Ler proposta pública por token
CREATE OR REPLACE FUNCTION public.get_proposal_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_p public.proposals; v_ver public.proposal_versions; v_out jsonb;
  v_cliente jsonb := NULL; v_lead jsonb := NULL; v_items jsonb;
BEGIN
  SELECT * INTO v_p FROM public.proposals WHERE token_publico = p_token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_p.current_version_id IS NOT NULL THEN
    SELECT * INTO v_ver FROM public.proposal_versions WHERE id = v_p.current_version_id;
  END IF;

  IF v_p.client_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'company', c.company, 'contact_name', c.contact_name,
      'segment', c.segment, 'city', c.city, 'state', c.state
    ) INTO v_cliente FROM public.clients c WHERE c.id = v_p.client_id;
  END IF;

  IF v_p.lead_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'company', pr.company, 'owner', pr.owner_name, 'segment', pr.segment
    ) INTO v_lead FROM public.prospects pr WHERE pr.id = v_p.lead_id;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(i) ORDER BY i.ordem), '[]'::jsonb) INTO v_items
    FROM public.proposal_items i WHERE i.proposal_id = v_p.id;

  v_out := jsonb_build_object(
    'id', v_p.id, 'numero', v_p.numero, 'titulo', v_p.titulo, 'status', v_p.status,
    'valor_implantacao', v_p.valor_implantacao, 'valor_mensal', v_p.valor_mensal,
    'valor_avulso', v_p.valor_avulso, 'validade_dias', v_p.validade_dias,
    'valid_until', v_p.valid_until, 'sent_at', v_p.sent_at,
    'first_viewed_at', v_p.first_viewed_at,
    'current_version_id', v_p.current_version_id,
    'cliente', v_cliente, 'lead', v_lead,
    'versao', CASE WHEN v_ver.id IS NULL THEN NULL ELSE
      jsonb_build_object('version_number', v_ver.version_number, 'conteudo_json', v_ver.conteudo_json)
    END,
    'items', v_items
  );
  RETURN v_out;
END $$;

GRANT EXECUTE ON FUNCTION public.get_proposal_by_token(text) TO anon, authenticated;

-- Registrar visualização
CREATE OR REPLACE FUNCTION public.register_proposal_view(
  p_token text, p_ua text, p_referrer text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.proposals WHERE token_publico = p_token;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.proposals SET
    first_viewed_at = COALESCE(first_viewed_at, now()),
    status = CASE WHEN status IN ('enviada') THEN 'visualizada'::public.proposal_status ELSE status END,
    updated_at = now()
  WHERE id = v_id;

  INSERT INTO public.proposal_events(proposal_id, event_type, actor_type, payload)
  VALUES (v_id, 'visualizada', 'client', jsonb_build_object('ua',p_ua,'referrer',p_referrer));
END $$;

GRANT EXECUTE ON FUNCTION public.register_proposal_view(text,text,text) TO anon, authenticated;

-- Decisão do cliente
CREATE OR REPLACE FUNCTION public.submit_proposal_decision(
  p_token text, p_decisao text, p_nome text, p_cargo text,
  p_documento text, p_mensagem text, p_ua text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_p public.proposals; v_new public.proposal_status;
BEGIN
  SELECT * INTO v_p FROM public.proposals WHERE token_publico = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;

  IF v_p.valid_until IS NOT NULL AND v_p.valid_until < now() THEN
    RAISE EXCEPTION 'proposta_expirada';
  END IF;
  IF v_p.status IN ('aprovada','rejeitada','expirada','convertida') THEN
    RAISE EXCEPTION 'proposta_ja_decidida';
  END IF;

  v_new := CASE p_decisao
    WHEN 'aprovada'  THEN 'aprovada'::public.proposal_status
    WHEN 'ajustes'   THEN 'ajustes_solicitados'::public.proposal_status
    WHEN 'rejeitada' THEN 'rejeitada'::public.proposal_status
    ELSE NULL END;
  IF v_new IS NULL THEN RAISE EXCEPTION 'decisao_invalida'; END IF;

  UPDATE public.proposals SET
    status = v_new,
    decided_at = CASE WHEN v_new IN ('aprovada','rejeitada') THEN now() ELSE decided_at END,
    motivo_aprovacao = CASE WHEN v_new='aprovada' THEN COALESCE(p_mensagem, motivo_aprovacao) ELSE motivo_aprovacao END,
    motivo_perda = CASE WHEN v_new='rejeitada' THEN COALESCE(p_mensagem, motivo_perda) ELSE motivo_perda END,
    updated_at = now()
  WHERE id = v_p.id;

  INSERT INTO public.proposal_events(proposal_id, event_type, actor_type, payload)
  VALUES (v_p.id, 'decisao_' || p_decisao, 'client',
    jsonb_build_object('nome',p_nome,'cargo',p_cargo,'documento',p_documento,'mensagem',p_mensagem,'ua',p_ua));

  -- Ajustes: registrar como pedido vinculado
  IF p_decisao = 'ajustes' AND COALESCE(p_mensagem,'') <> '' THEN
    INSERT INTO public.proposal_adjustments(proposal_id, origem, autor_nome, autor_cargo, mensagem)
    VALUES (v_p.id, 'cliente', p_nome, p_cargo, p_mensagem);
  END IF;

  RETURN jsonb_build_object('status', v_new);
END $$;

GRANT EXECUTE ON FUNCTION public.submit_proposal_decision(text,text,text,text,text,text,text) TO anon, authenticated;

-- ===================== VIEWS BI =====================
CREATE OR REPLACE VIEW public.vw_proposal_kpis
WITH (security_invoker = true) AS
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status='rascunho')::int AS rascunho,
  COUNT(*) FILTER (WHERE status IN ('enviada','visualizada','ajustes_solicitados','aprovada','rejeitada','expirada','convertida'))::int AS enviadas,
  COUNT(*) FILTER (WHERE first_viewed_at IS NOT NULL)::int AS visualizadas,
  COUNT(*) FILTER (WHERE status IN ('aprovada','convertida'))::int AS aprovadas,
  COUNT(*) FILTER (WHERE status='rejeitada')::int AS rejeitadas,
  COUNT(*) FILTER (WHERE status='expirada')::int AS expiradas,
  COALESCE(SUM((valor_implantacao + valor_mensal*12)) FILTER (WHERE status IN ('enviada','visualizada','ajustes_solicitados','aprovada','rejeitada','expirada','convertida') AND sent_at > now() - interval '12 months'),0)::numeric AS valor_total_enviado,
  COALESCE(SUM((valor_implantacao + valor_mensal*12)) FILTER (WHERE status IN ('aprovada','convertida') AND decided_at > now() - interval '12 months'),0)::numeric AS valor_total_aprovado,
  COALESCE(SUM((valor_implantacao + valor_mensal*12)) FILTER (WHERE status IN ('rejeitada','expirada')),0)::numeric AS valor_perdido,
  CASE WHEN COUNT(*) FILTER (WHERE status IN ('aprovada','convertida')) > 0
       THEN COALESCE(SUM((valor_implantacao + valor_mensal*12)) FILTER (WHERE status IN ('aprovada','convertida')),0)::numeric
            / COUNT(*) FILTER (WHERE status IN ('aprovada','convertida'))
       ELSE 0 END AS ticket_medio,
  CASE WHEN COUNT(*) FILTER (WHERE status IN ('enviada','visualizada','ajustes_solicitados','aprovada','rejeitada','expirada','convertida')) > 0
       THEN 100.0 * COUNT(*) FILTER (WHERE status IN ('aprovada','convertida'))
            / COUNT(*) FILTER (WHERE status IN ('enviada','visualizada','ajustes_solicitados','aprovada','rejeitada','expirada','convertida'))
       ELSE 0 END AS taxa_aprovacao
FROM public.proposals
WHERE user_id = auth.uid();

GRANT SELECT ON public.vw_proposal_kpis TO authenticated;

CREATE OR REPLACE VIEW public.vw_proposal_conversion
WITH (security_invoker = true) AS
SELECT
  COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int AS enviadas,
  COUNT(*) FILTER (WHERE first_viewed_at IS NOT NULL)::int AS visualizadas,
  COUNT(*) FILTER (WHERE decided_at IS NOT NULL)::int AS decididas,
  COALESCE(AVG(EXTRACT(EPOCH FROM (first_viewed_at - sent_at))/3600.0)
    FILTER (WHERE sent_at IS NOT NULL AND first_viewed_at IS NOT NULL),0)::numeric AS tempo_medio_visualizacao_h,
  COALESCE(AVG(EXTRACT(EPOCH FROM (decided_at - sent_at))/3600.0)
    FILTER (WHERE sent_at IS NOT NULL AND decided_at IS NOT NULL),0)::numeric AS tempo_medio_decisao_h
FROM public.proposals WHERE user_id = auth.uid();

GRANT SELECT ON public.vw_proposal_conversion TO authenticated;

CREATE OR REPLACE VIEW public.vw_proposal_funnel_full
WITH (security_invoker = true) AS
SELECT status::text, COUNT(*)::int AS total,
  COALESCE(SUM(valor_implantacao + valor_mensal*12),0)::numeric AS valor_total
FROM public.proposals WHERE user_id = auth.uid()
GROUP BY status;

GRANT SELECT ON public.vw_proposal_funnel_full TO authenticated;

CREATE OR REPLACE VIEW public.vw_proposal_timeline
WITH (security_invoker = true) AS
SELECT e.id, e.proposal_id, e.event_type, e.actor_type, e.actor_id, e.payload, e.created_at
FROM public.proposal_events e
JOIN public.proposals p ON p.id = e.proposal_id
WHERE p.user_id = auth.uid();

GRANT SELECT ON public.vw_proposal_timeline TO authenticated;

CREATE OR REPLACE VIEW public.vw_proposal_revenue_forecast
WITH (security_invoker = true) AS
WITH base AS (
  SELECT p.id, p.status, p.decided_at, p.sent_at,
         p.valor_implantacao, p.valor_mensal, p.valor_avulso,
         date_trunc('month', COALESCE(p.decided_at, p.sent_at, p.created_at))::date AS mes
  FROM public.proposals p WHERE p.user_id = auth.uid()
    AND p.status IN ('aprovada','convertida')
)
SELECT 'implantacao'::text AS tipo, to_char(mes,'YYYY-MM') AS competencia_mes,
       COUNT(*)::int AS propostas, COALESCE(SUM(valor_implantacao),0)::numeric AS valor
FROM base GROUP BY mes
UNION ALL
SELECT 'mrr'::text, to_char(mes,'YYYY-MM'), COUNT(*)::int, COALESCE(SUM(valor_mensal),0)::numeric
FROM base GROUP BY mes
UNION ALL
SELECT 'avulso'::text, to_char(mes,'YYYY-MM'), COUNT(*)::int, COALESCE(SUM(valor_avulso),0)::numeric
FROM base GROUP BY mes;

GRANT SELECT ON public.vw_proposal_revenue_forecast TO authenticated;
