-- Propostas: listagens do módulo e do BI
CREATE INDEX IF NOT EXISTS idx_proposals_org
  ON public.proposals (organization_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org_status_updated
  ON public.proposals (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_org_updated
  ON public.proposals (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_valid_until
  ON public.proposals (valid_until)
  WHERE valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_deal
  ON public.proposals (deal_id)
  WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_lead
  ON public.proposals (lead_id)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_current_version
  ON public.proposals (current_version_id)
  WHERE current_version_id IS NOT NULL;

-- Cobrança de clientes: relatórios por mês e por status
CREATE INDEX IF NOT EXISTS idx_cbi_org_venc
  ON public.client_billing_items (organization_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_cbi_org_status_venc
  ON public.client_billing_items (organization_id, status, vencimento);
CREATE INDEX IF NOT EXISTS idx_cbi_client_venc
  ON public.client_billing_items (client_id, vencimento);

-- Deals: BI de conversão e por estágio dentro da org
CREATE INDEX IF NOT EXISTS idx_deals_org_stage
  ON public.deals (organization_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_closed
  ON public.deals (organization_id, closed_at DESC)
  WHERE closed_at IS NOT NULL;

-- Prospect touchpoints: métricas por período dentro da org
CREATE INDEX IF NOT EXISTS idx_prospect_touchpoints_org_enviado
  ON public.prospect_touchpoints (organization_id, enviado_em DESC);

-- Op campaigns: agregações por org e por cliente
CREATE INDEX IF NOT EXISTS idx_op_campaigns_org
  ON public.op_campaigns (organization_id);
CREATE INDEX IF NOT EXISTS idx_op_campaigns_client
  ON public.op_campaigns (client_id);

-- Clients: cortes recorrentes por estágio + org e por atualização
CREATE INDEX IF NOT EXISTS idx_clients_org_stage
  ON public.clients (organization_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_clients_org_updated
  ON public.clients (organization_id, updated_at DESC);