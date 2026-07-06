GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_billing_items TO authenticated;
GRANT ALL ON public.client_billing_items TO service_role;
NOTIFY pgrst, 'reload schema';