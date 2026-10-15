-- ============================================================
-- Robô de varredura: corrige status de prospects pendentes.
--
-- Problema resolvido:
--   Quando o operador dispara (WhatsApp/ligação/email) e o
--   banco falha em gravar o touchpoint (rede instável, sessão
--   expirada no celular), o lead volta para "nao_contatado" no
--   próximo carregamento da página e reaparece no topo da fila.
--
-- Solução:
--   A cada 5 minutos este job varre prospect_touchpoints e,
--   para cada prospect que tem disparo outbound registrado mas
--   cujo status privado ainda é "nao_contatado", grava um
--   touchpoint de status corretivo → "primeiro_contato".
--
-- Fonte única de status privado: prospect_touchpoints.
-- Não altera a coluna status da tabela prospects (arquitetura
-- híbrida do projeto: status é calculado por usuário a partir
-- dos touchpoints).
-- ============================================================

-- ── 1. Função de varredura ──────────────────────────────────

create or replace function public.fix_pending_prospect_status()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixed integer := 0;
  v_rec   record;
begin
  -- Prospects por usuário que têm pelo menos 1 touchpoint outbound
  -- mas cujo status atual ainda é "nao_contatado" (sem touchpoint
  -- de status posterior).
  for v_rec in
    select distinct on (tp.prospect_id, tp.user_id)
      tp.prospect_id,
      tp.user_id,
      tp.enviado_em  as last_dispatch_at
    from prospect_touchpoints tp
    where tp.tipo in ('whatsapp', 'ligacao', 'email')
      -- Só varredura nos últimos 7 dias (janela razoável)
      and tp.enviado_em > now() - interval '7 days'
      -- Não tem touchpoint de status "primeiro_contato" ou superior
      and not exists (
        select 1
        from prospect_touchpoints st
        where st.prospect_id = tp.prospect_id
          and st.user_id     = tp.user_id
          and st.tipo        = 'status'
          and st.mensagem    like 'status:%'
          and st.mensagem   != 'status:nao_contatado'
          and st.enviado_em  > tp.enviado_em - interval '1 minute'
      )
    order by tp.prospect_id, tp.user_id, tp.enviado_em desc
  loop
    -- Grava o status corretivo como touchpoint privado
    insert into prospect_touchpoints (
      prospect_id,
      user_id,
      tipo,
      resultado,
      mensagem,
      by_name,
      enviado_em
    ) values (
      v_rec.prospect_id,
      v_rec.user_id,
      'status',
      'enviado',
      'status:primeiro_contato',
      'Robô: correção automática de status pendente',
      v_rec.last_dispatch_at + interval '1 second'
    )
    -- Evita inserção duplicada se o job rodar em paralelo
    on conflict do nothing;

    v_fixed := v_fixed + 1;
  end loop;

  -- Log resumido para auditoria
  if v_fixed > 0 then
    raise notice '[fix_pending_prospect_status] % lead(s) corrigido(s) em %',
      v_fixed, now();
  end if;

  return v_fixed;
end;
$$;

grant execute on function public.fix_pending_prospect_status() to service_role;

-- ── 2. Agendamento via pg_cron (a cada 5 minutos) ──────────

select cron.unschedule('fix-pending-prospect-status')
where exists (
  select 1 from cron.job where jobname = 'fix-pending-prospect-status'
);

select cron.schedule(
  'fix-pending-prospect-status',
  '*/5 * * * *',
  $$ select public.fix_pending_prospect_status(); $$
);

-- ── 3. Como acompanhar ─────────────────────────────────────
-- Ver jobs agendados:
--   select * from cron.job where jobname = 'fix-pending-prospect-status';
--
-- Ver execuções recentes:
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'fix-pending-prospect-status')
--   order by start_time desc limit 20;
--
-- Ver quantos leads foram corrigidos hoje:
--   select count(*) from prospect_touchpoints
--   where by_name = 'Robô: correção automática de status pendente'
--     and enviado_em > now() - interval '24 hours';
--
-- Rodar manualmente para testar:
--   select public.fix_pending_prospect_status();
