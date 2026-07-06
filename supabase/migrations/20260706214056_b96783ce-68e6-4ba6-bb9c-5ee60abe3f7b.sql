ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS origem_detalhe text;

CREATE INDEX IF NOT EXISTS idx_clients_origem ON public.clients(organization_id, origem);

COMMENT ON COLUMN public.clients.origem IS 'Origem do cliente: indicacao, prospeccao_fria, instagram, anuncio, evento, parceiro, site_organico, retorno, outro';
COMMENT ON COLUMN public.clients.origem_detalhe IS 'Detalhe livre (ex.: nome do indicador, nome da campanha)';