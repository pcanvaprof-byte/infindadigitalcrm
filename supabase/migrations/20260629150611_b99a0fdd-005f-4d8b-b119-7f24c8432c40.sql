DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients') THEN
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS contract_term_months integer,
      ADD COLUMN IF NOT EXISTS contract_end_at timestamptz,
      ADD COLUMN IF NOT EXISTS is_permuta boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS permuta_value numeric(12,2),
      ADD COLUMN IF NOT EXISTS permuta_description text;
  END IF;
END $$;