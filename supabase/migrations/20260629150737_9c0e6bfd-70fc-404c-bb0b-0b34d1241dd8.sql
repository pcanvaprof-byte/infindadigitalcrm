DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients') THEN
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS site_one_time_value numeric(12,2),
      ADD COLUMN IF NOT EXISTS site_recurring_value numeric(12,2),
      ADD COLUMN IF NOT EXISTS site_payment_status text,
      ADD COLUMN IF NOT EXISTS contract_notes text;
  END IF;
END $$;