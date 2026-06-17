-- ============================================================
-- FASE 1: Motor operacional INFINDA — Briefings + Kickoff + CRM
-- Automações encadeadas: status do prospect + atividades + auto-Kickoff
-- Aplique no SQL Editor do Supabase (Lovable Cloud).
-- ============================================================

-- 1. Helper interno -------------------------------------------------------
create or replace function public._infinda_log_activity(
  p_lead uuid, p_user uuid, p_kind text, p_text text
) returns void
language sql security definer set search_path = public as $$
  insert into public.prospect_interactions(prospect_id, user_id, kind, text, by_name)
  select p_lead, p_user, p_kind, p_text, 'Dany (IA)'
   where p_lead is not null and p_user is not null;
$$;

-- 2. update_briefing_by_token --------------------------------------------
create or replace function public.update_briefing_by_token(
  p_token text, p_respostas jsonb, p_status text default null
) returns public.briefings
language plpgsql security definer set search_path = public as $$
declare v_row public.briefings; v_was_concluido boolean;
begin
  select * into v_row from public.briefings where token_publico = p_token limit 1;
  if not found then raise exception 'briefing_not_found'; end if;
  v_was_concluido := (v_row.status = 'concluido');

  update public.briefings
     set respostas_json = coalesce(p_respostas, respostas_json),
         status = case when p_status in ('em_preenchimento','concluido') then p_status else status end
   where token_publico = p_token
   returning * into v_row;

  if not v_was_concluido and v_row.status = 'concluido' and v_row.lead_id is not null then
    if v_row.tipo = 'briefing_comercial' then
      update public.prospects set status = 'diagnostico_pendente', updated_at = now() where id = v_row.lead_id;
      perform public._infinda_log_activity(v_row.lead_id, v_row.user_id, 'nota',
        'Briefing Comercial recebido — pronto para gerar diagnóstico.');
    elsif v_row.tipo = 'kickoff_producao' then
      update public.prospects set status = 'aguardando_producao', updated_at = now() where id = v_row.lead_id;
      perform public._infinda_log_activity(v_row.lead_id, v_row.user_id, 'nota',
        'Kickoff concluído — gerando resumo operacional.');
    end if;
  end if;
  return v_row;
end;
$$;
grant execute on function public.update_briefing_by_token(text, jsonb, text) to anon, authenticated;

-- 3. set_briefing_resumo_ia (chained automations) ------------------------
create or replace function public.set_briefing_resumo_ia(p_token text, p_resumo text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_row public.briefings;
begin
  update public.briefings set resumo_ia = p_resumo where token_publico = p_token returning * into v_row;
  if v_row.lead_id is null then return; end if;
  if v_row.tipo = 'briefing_comercial' then
    update public.prospects set status = 'proposta_pendente', updated_at = now() where id = v_row.lead_id;
    perform public._infinda_log_activity(v_row.lead_id, v_row.user_id, 'nota',
      'Diagnóstico IA pronto — gerar e enviar proposta comercial.');
  elsif v_row.tipo = 'kickoff_producao' then
    perform public._infinda_log_activity(v_row.lead_id, v_row.user_id, 'nota',
      'Resumo Operacional gerado — projeto pronto para produção.');
  end if;
end;
$$;
grant execute on function public.set_briefing_resumo_ia(text, text) to authenticated, service_role;

-- 4. Trigger: prospect fechado_ganho → cria Kickoff auto -----------------
create or replace function public._infinda_on_prospect_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_token text; v_has_kickoff boolean;
begin
  if new.status is distinct from old.status and new.status = 'fechado_ganho' then
    select exists(
      select 1 from public.briefings
       where lead_id = new.id and tipo = 'kickoff_producao' and status <> 'cancelado'
    ) into v_has_kickoff;
    if not v_has_kickoff then
      v_token := encode(gen_random_bytes(16), 'hex');
      insert into public.briefings(
        user_id, tipo, lead_id, cliente_nome, empresa, telefone, email,
        servico, status, token_publico, respostas_json
      ) values (
        new.user_id, 'kickoff_producao', new.id,
        new.owner_name, new.company, new.phone, new.email,
        'gestao_trafego', 'pendente', v_token, '{}'::jsonb
      );
      perform public._infinda_log_activity(new.id, new.user_id, 'nota',
        'Kickoff de Produção criado automaticamente — envie o link ao cliente.');
      new.status := 'aguardando_kickoff';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_infinda_prospect_status on public.prospects;
create trigger trg_infinda_prospect_status
  before update on public.prospects
  for each row execute function public._infinda_on_prospect_status_change();

-- 5. Trigger: briefing_comercial criado ----------------------------------
create or replace function public._infinda_on_briefing_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'briefing_comercial' and new.lead_id is not null then
    update public.prospects
       set status = case when status in ('nao_contatado','primeiro_contato')
                         then 'briefing_enviado' else status end,
           updated_at = now()
     where id = new.lead_id;
    perform public._infinda_log_activity(new.lead_id, new.user_id, 'nota',
      'Briefing Comercial enviado ao cliente.');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_infinda_briefing_created on public.briefings;
create trigger trg_infinda_briefing_created
  after insert on public.briefings
  for each row execute function public._infinda_on_briefing_created();

notify pgrst, 'reload schema';
