
CREATE TABLE public.client_billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'avulso' CHECK (tipo IN ('implantacao','mensalidade','avulso')),
  valor numeric(12,2) NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','bonificado','cancelado')),
  pago_em timestamptz,
  metodo text,
  observacao text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cbi_client ON public.client_billing_items(client_id);
CREATE INDEX idx_cbi_org ON public.client_billing_items(organization_id);
CREATE INDEX idx_cbi_venc ON public.client_billing_items(vencimento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_billing_items TO authenticated;
GRANT ALL ON public.client_billing_items TO service_role;

ALTER TABLE public.client_billing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cbi_tenant_all ON public.client_billing_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY cbi_org_members_rw ON public.client_billing_items
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE TRIGGER trg_cbi_updated_at
  BEFORE UPDATE ON public.client_billing_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
