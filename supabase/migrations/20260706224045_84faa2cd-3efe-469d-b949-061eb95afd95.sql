
-- =========================================================================
-- LIFECYCLE
-- =========================================================================

-- plan_templates: catálogo global de planos comerciais
CREATE TABLE public.plan_templates (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mensalidade NUMERIC(12,2) NOT NULL DEFAULT 0,
  campaigns JSONB NOT NULL DEFAULT '[]'::jsonb,
  deliveries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_templates TO authenticated;
GRANT ALL ON public.plan_templates TO service_role;
ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_templates_read ON public.plan_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_templates_admin_write ON public.plan_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_plan_templates_updated BEFORE UPDATE ON public.plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- commercial_plans: 1 plano ativo por cliente
CREATE TABLE public.commercial_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  investimento_gestao NUMERIC(12,2),
  investimento_trafego NUMERIC(12,2),
  objetivo TEXT,
  entregas JSONB NOT NULL DEFAULT '[]'::jsonb,
  cronograma JSONB NOT NULL DEFAULT '{}'::jsonb,
  validade_dias INT NOT NULL DEFAULT 7,
  plano_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_plans TO authenticated;
GRANT ALL ON public.commercial_plans TO service_role;
ALTER TABLE public.commercial_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY commercial_plans_org_rw ON public.commercial_plans FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_commercial_plans_org ON public.commercial_plans(organization_id);
CREATE TRIGGER trg_commercial_plans_updated BEFORE UPDATE ON public.commercial_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- client_events: histórico livre por cliente
CREATE TABLE public.client_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID DEFAULT auth.uid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_events TO authenticated;
GRANT ALL ON public.client_events TO service_role;
ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_events_org_rw ON public.client_events FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_client_events_org ON public.client_events(organization_id);
CREATE INDEX idx_client_events_client_created ON public.client_events(client_id, created_at DESC);

-- client_timeline: view unificada (eventos + transições de estágio via clients.updated_at)
CREATE VIEW public.client_timeline
WITH (security_invoker = true)
AS
  SELECT
    e.client_id,
    e.created_at,
    'event'::text AS kind,
    jsonb_build_object('type', e.type, 'payload', e.payload) AS data
  FROM public.client_events e
  UNION ALL
  SELECT
    c.id AS client_id,
    c.updated_at AS created_at,
    'transition'::text AS kind,
    jsonb_build_object('stage', c.pipeline_stage::text, 'step', c.current_step) AS data
  FROM public.clients c;
GRANT SELECT ON public.client_timeline TO authenticated;

-- =========================================================================
-- OPERAÇÕES FASE 2
-- =========================================================================

-- op_onboarding
CREATE TABLE public.op_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  company_name TEXT,
  cnpj TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  youtube TEXT,
  meta_ads_connected BOOLEAN NOT NULL DEFAULT false,
  google_ads_connected BOOLEAN NOT NULL DEFAULT false,
  analytics_connected BOOLEAN NOT NULL DEFAULT false,
  tag_manager_connected BOOLEAN NOT NULL DEFAULT false,
  goal_type TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aguardando_cliente','em_configuracao','concluido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_onboarding TO authenticated;
GRANT ALL ON public.op_onboarding TO service_role;
ALTER TABLE public.op_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY op_onboarding_org_rw ON public.op_onboarding FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_op_onboarding_org ON public.op_onboarding(organization_id);
CREATE INDEX idx_op_onboarding_client ON public.op_onboarding(client_id);
CREATE TRIGGER trg_op_onboarding_updated BEFORE UPDATE ON public.op_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- op_deployments
CREATE TABLE public.op_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('Pixel','CAPI','Analytics','Tag Manager','Landing Page','Google Ads','Meta Ads','CRM','Automação')),
  status TEXT NOT NULL DEFAULT 'nao_iniciado'
    CHECK (status IN ('nao_iniciado','em_andamento','aguardando_aprovacao','concluido')),
  priority TEXT NOT NULL DEFAULT 'Normal'
    CHECK (priority IN ('Baixa','Normal','Alta','Crítica')),
  assigned_to UUID,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_deployments TO authenticated;
GRANT ALL ON public.op_deployments TO service_role;
ALTER TABLE public.op_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY op_deployments_org_rw ON public.op_deployments FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_op_deployments_org ON public.op_deployments(organization_id);
CREATE INDEX idx_op_deployments_client ON public.op_deployments(client_id);
CREATE INDEX idx_op_deployments_status ON public.op_deployments(organization_id, status);
CREATE TRIGGER trg_op_deployments_updated BEFORE UPDATE ON public.op_deployments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- op_contract_renewals
CREATE TABLE public.op_contract_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  contract_start DATE,
  contract_end DATE NOT NULL,
  renewal_status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (renewal_status IN ('ativo','renovado','cancelado')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_contract_renewals TO authenticated;
GRANT ALL ON public.op_contract_renewals TO service_role;
ALTER TABLE public.op_contract_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY op_contract_renewals_org_rw ON public.op_contract_renewals FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_op_renewals_org ON public.op_contract_renewals(organization_id);
CREATE INDEX idx_op_renewals_end ON public.op_contract_renewals(organization_id, contract_end);
CREATE TRIGGER trg_op_renewals_updated BEFORE UPDATE ON public.op_contract_renewals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- View: op_onboarding_progress
CREATE VIEW public.op_onboarding_progress
WITH (security_invoker = true)
AS
  SELECT
    o.id,
    o.organization_id,
    o.client_id,
    o.owner_id,
    o.status,
    (
      (CASE WHEN o.meta_ads_connected THEN 1 ELSE 0 END) +
      (CASE WHEN o.google_ads_connected THEN 1 ELSE 0 END) +
      (CASE WHEN o.analytics_connected THEN 1 ELSE 0 END) +
      (CASE WHEN o.tag_manager_connected THEN 1 ELSE 0 END) +
      (CASE WHEN NULLIF(o.website,'') IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN NULLIF(o.goal_type,'') IS NOT NULL THEN 1 ELSE 0 END)
    ) AS steps_done,
    6 AS steps_total,
    ROUND(100.0 * (
      (CASE WHEN o.meta_ads_connected THEN 1 ELSE 0 END) +
      (CASE WHEN o.google_ads_connected THEN 1 ELSE 0 END) +
      (CASE WHEN o.analytics_connected THEN 1 ELSE 0 END) +
      (CASE WHEN o.tag_manager_connected THEN 1 ELSE 0 END) +
      (CASE WHEN NULLIF(o.website,'') IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN NULLIF(o.goal_type,'') IS NOT NULL THEN 1 ELSE 0 END)
    ) / 6.0, 0)::int AS progress
  FROM public.op_onboarding o;
GRANT SELECT ON public.op_onboarding_progress TO authenticated;

-- View: op_renewals_status (calcula dias e classificação)
CREATE VIEW public.op_renewals_status
WITH (security_invoker = true)
AS
  SELECT
    r.*,
    (r.contract_end - CURRENT_DATE) AS days_to_expire,
    CASE
      WHEN r.renewal_status = 'renovado' THEN 'Renovado'
      WHEN r.renewal_status = 'cancelado' THEN 'Cancelado'
      WHEN r.contract_end < CURRENT_DATE THEN 'Vencido'
      WHEN r.contract_end - CURRENT_DATE <= 15 THEN 'Urgente'
      WHEN r.contract_end - CURRENT_DATE <= 45 THEN 'Próximo Vencimento'
      ELSE 'Ativo'
    END AS computed_status
  FROM public.op_contract_renewals r;
GRANT SELECT ON public.op_renewals_status TO authenticated;

-- View: op_dashboard_exec_metrics (uma linha por organização ativa)
CREATE VIEW public.op_dashboard_exec_metrics
WITH (security_invoker = true)
AS
  WITH org AS (SELECT public.current_org_id() AS org_id),
  c AS (
    SELECT * FROM public.clients WHERE organization_id = (SELECT org_id FROM org)
  ),
  ob AS (
    SELECT * FROM public.op_onboarding WHERE organization_id = (SELECT org_id FROM org)
  ),
  dep AS (
    SELECT * FROM public.op_deployments WHERE organization_id = (SELECT org_id FROM org)
  ),
  camp AS (
    SELECT * FROM public.op_campaigns WHERE organization_id = (SELECT org_id FROM org)
  )
  SELECT
    (SELECT COUNT(*) FROM c)::int AS total_clientes,
    (SELECT COUNT(*) FROM c WHERE pipeline_stage::text = 'ATIVO')::int AS clientes_ativos,
    (SELECT COUNT(*) FROM c WHERE pipeline_stage::text IN ('CHURNED','PERDIDO'))::int AS clientes_inativos,
    (SELECT COUNT(*) FROM ob WHERE status = 'pendente')::int AS onboarding_pendente,
    (SELECT COUNT(*) FROM ob WHERE status = 'em_configuracao')::int AS onboarding_em_configuracao,
    (SELECT COUNT(*) FROM ob WHERE status = 'concluido')::int AS onboarding_concluido,
    (SELECT COUNT(*) FROM dep)::int AS deployments_total,
    (SELECT COUNT(*) FROM dep WHERE status = 'concluido')::int AS deployments_concluidos,
    (SELECT COUNT(*) FROM dep WHERE status IN ('em_andamento','aguardando_aprovacao'))::int AS deployments_andamento,
    (SELECT COUNT(*) FROM camp WHERE status = 'ativa')::int AS campanhas_ativas,
    (SELECT COUNT(*) FROM camp WHERE status = 'pausada')::int AS campanhas_pausadas,
    (SELECT COUNT(*) FROM camp WHERE status = 'encerrada')::int AS campanhas_encerradas,
    0::int AS interacoes_30d,
    (SELECT COUNT(*) FROM c WHERE NOT EXISTS (SELECT 1 FROM ob WHERE ob.client_id = c.id))::int AS clientes_sem_onboarding,
    (SELECT COUNT(*) FROM c WHERE NOT EXISTS (SELECT 1 FROM camp WHERE camp.client_id = c.id AND camp.status = 'ativa'))::int AS clientes_sem_campanha_ativa,
    (SELECT COUNT(*) FROM c WHERE EXISTS (SELECT 1 FROM dep WHERE dep.client_id = c.id AND dep.status <> 'concluido'))::int AS clientes_com_implantacao_pendente,
    (SELECT COUNT(*) FROM public.op_contract_renewals r
      WHERE r.organization_id = (SELECT org_id FROM org)
        AND r.renewal_status = 'ativo'
        AND r.contract_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS contratos_vencendo_30d;
GRANT SELECT ON public.op_dashboard_exec_metrics TO authenticated;

-- =========================================================================
-- CONTRATOS
-- =========================================================================

CREATE TABLE public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando_formalizacao'
    CHECK (status IN ('aguardando_formalizacao','em_preenchimento','aguardando_assinatura','assinado','pendente_financeiro','ativo','cancelado','encerrado')),
  valor_implantacao NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_mensal NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_investimento_midia NUMERIC(14,2),
  prazo_minimo_meses INT NOT NULL DEFAULT 3,
  prazo_implantacao_dias INT,
  tipo_pessoa TEXT CHECK (tipo_pessoa IN ('pf','pj')),
  dados_pessoa JSONB NOT NULL DEFAULT '{}'::jsonb,
  metodo_pagamento TEXT CHECK (metodo_pagamento IN ('pix','boleto','cartao','transferencia')),
  dia_vencimento INT CHECK (dia_vencimento BETWEEN 1 AND 31),
  parcelamento_implantacao INT,
  dados_bancarios JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes_financeiras TEXT,
  escopo JSONB NOT NULL DEFAULT '[]'::jsonb,
  aceites JSONB NOT NULL DEFAULT '{}'::jsonb,
  assinatura_tipo TEXT CHECK (assinatura_tipo IN ('desenhada','digitada','email')),
  assinatura_payload TEXT,
  assinatura_nome TEXT,
  assinatura_ip TEXT,
  assinatura_user_agent TEXT,
  assinado_em TIMESTAMPTZ,
  pdf_url TEXT,
  pdf_gerado_em TIMESTAMPTZ,
  formalizado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  cancelado_motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contratos_org_rw ON public.contratos FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_contratos_org ON public.contratos(organization_id);
CREATE INDEX idx_contratos_proposal ON public.contratos(proposal_id);
CREATE INDEX idx_contratos_status ON public.contratos(organization_id, status);
CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.contrato_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID DEFAULT auth.uid(),
  actor_type TEXT NOT NULL DEFAULT 'user',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_eventos TO authenticated;
GRANT ALL ON public.contrato_eventos TO service_role;
ALTER TABLE public.contrato_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrato_eventos_org_rw ON public.contrato_eventos FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_contrato_eventos_contrato ON public.contrato_eventos(contrato_id, created_at DESC);

-- View: vw_contratos_kpis
CREATE VIEW public.vw_contratos_kpis
WITH (security_invoker = true)
AS
  WITH base AS (
    SELECT * FROM public.contratos WHERE organization_id = public.current_org_id()
  )
  SELECT
    (SELECT COUNT(*) FROM base WHERE status = 'ativo')::int AS ativos,
    (SELECT COUNT(*) FROM base WHERE status IN ('aguardando_formalizacao','em_preenchimento','aguardando_assinatura','pendente_financeiro'))::int AS pendentes,
    (SELECT COUNT(*) FROM base WHERE status IN ('assinado','ativo'))::int AS assinados,
    (SELECT COUNT(*) FROM base WHERE status IN ('cancelado','encerrado'))::int AS cancelados,
    COALESCE((SELECT SUM(valor_mensal) FROM base WHERE status = 'ativo'), 0)::numeric AS mrr,
    COALESCE((SELECT SUM(valor_mensal) * 12 FROM base WHERE status = 'ativo'), 0)::numeric AS arr,
    COALESCE((SELECT AVG(valor_mensal) FROM base WHERE status = 'ativo'), 0)::numeric AS ticket_medio;
GRANT SELECT ON public.vw_contratos_kpis TO authenticated;
