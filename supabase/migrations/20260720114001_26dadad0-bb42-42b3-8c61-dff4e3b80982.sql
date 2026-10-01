
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_profiles','company_addresses','company_locations','company_market_data','company_scores','company_visits','company_enrichment_logs']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
