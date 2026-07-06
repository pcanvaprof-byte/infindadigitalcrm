-- Bloco 4.2 — Revogar EXECUTE de anon/authenticated em funções SECURITY DEFINER
-- que não são chamadas pelo cliente. Funções continuam executáveis via SECURITY
-- DEFINER quando chamadas por outras funções internas (rodam como o owner).

DO $$
DECLARE
  fn_sig text;
  internal_fns text[] := ARRAY[
    -- BI helpers (apenas chamados por bi_dashboard)
    'public.bi_best_channels()',
    'public.bi_best_contact_hours()',
    'public.bi_churn_risk()',
    'public.bi_clients_perdidos()',
    'public.bi_financial_kpis()',
    'public.bi_funnel_bottlenecks()',
    'public.bi_lost_opportunities()',
    'public.bi_revenue_forecast()',
    'public.bi_top_campaigns()',
    -- Cadência (não chamadas pelo cliente)
    'public.cad_apply_pack(text)',
    'public.cad_create_custom_pack(text, text, text, text, text)',
    'public.cad_get_default_seed_pack()',
    'public.cad_set_default_seed_pack(text)',
    -- Helpers de organização (usados só em políticas RLS)
    'public.is_member_of_org(uuid)',
    'public.is_org_admin(uuid)'
  ];
BEGIN
  FOREACH fn_sig IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn_sig);
  END LOOP;
END $$;