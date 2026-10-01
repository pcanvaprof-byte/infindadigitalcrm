-- Adiciona os eventos do Mercado Pago à constraint da tabela user_access_events.
-- Motivo: o webhook do MP tentava gravar auditoria com eventos MP_* mas a
-- constraint original só permitia ACCESS_CREATED/RENEWED/EXPIRED/etc,
-- então os inserts falhavam silenciosamente dentro do try/catch do handler.

ALTER TABLE public.user_access_events
  DROP CONSTRAINT IF EXISTS user_access_events_event_check;

ALTER TABLE public.user_access_events
  ADD CONSTRAINT user_access_events_event_check
  CHECK (event IN (
    'ACCESS_CREATED','ACCESS_RENEWED','ACCESS_EXPIRED',
    'PASSWORD_CHANGED','ACCOUNT_BLOCKED','LOGIN',
    'MP_PREAPPROVAL_CREATED','MP_SUBSCRIPTION_ACTIVE','MP_SUBSCRIPTION_SUSPENDED'
  ));