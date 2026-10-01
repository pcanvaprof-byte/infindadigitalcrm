ALTER TABLE public.company_visits ADD COLUMN IF NOT EXISTS retornar_em date;

CREATE INDEX IF NOT EXISTS company_visits_user_cnpj_idx ON public.company_visits (user_id, cnpj);
CREATE INDEX IF NOT EXISTS company_visits_user_retornar_idx ON public.company_visits (user_id, retornar_em) WHERE retornar_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_visits_visited_at_idx ON public.company_visits (user_id, visited_at DESC);