-- Enriquecimento automático em background: 20 CNPJs a cada 1 minuto.
-- Chama a rota pública /api/public/hooks/enrich-batch (autenticada pelo apikey).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('enrich-batch-every-minute')
where exists (select 1 from cron.job where jobname = 'enrich-batch-every-minute');

select cron.schedule(
  'enrich-batch-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://infindadigitalcrm.lovable.app/api/public/hooks/enrich-batch',
    headers := '{"Content-Type": "application/json", "apikey": "REPLACE_WITH_PUBLISHABLE_KEY"}'::jsonb,
    body := '{"limit": 20}'::jsonb,
    timeout_milliseconds := 55000
  ) as request_id;
  $$
);

-- Acompanhamento:
--   select * from cron.job where jobname = 'enrich-batch-every-minute';
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select status, count(*) from public.company_enrichment_logs
--     where created_at > now() - interval '24 hours' group by 1;
