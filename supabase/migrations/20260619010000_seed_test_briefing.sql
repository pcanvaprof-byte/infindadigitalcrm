-- Seed: cliente teste + primeiro briefing comercial (idempotente)
do $$
declare
  v_user uuid;
  v_lead uuid;
  v_token text := 'teste-briefing-0001';
begin
  select id into v_user from auth.users order by created_at asc limit 1;
  if v_user is null then
    raise notice 'Nenhum usuário em auth.users — seed pulado.';
    return;
  end if;

  select id into v_lead from public.prospects
   where user_id = v_user and company = 'Cliente Teste Infinda' limit 1;

  if v_lead is null then
    insert into public.prospects(user_id, company, owner_name, whatsapp, phone, email, segment, source, potential, status)
    values (v_user, 'Cliente Teste Infinda', 'João Teste', '11999990000', '11999990000',
            'teste@infinda.dev', 'Outros', 'briefing', 'medio', 'nao_contatado')
    returning id into v_lead;
  end if;

  if not exists (select 1 from public.briefings where token_publico = v_token) then
    insert into public.briefings(user_id, tipo, lead_id, cliente_nome, empresa, telefone, email,
                                 servico, responsavel, token_publico, status, respostas_json)
    values (v_user, 'briefing_comercial', v_lead, 'João Teste', 'Cliente Teste Infinda',
            '11999990000', 'teste@infinda.dev', 'social_media', 'Equipe Infinda',
            v_token, 'pendente', '{}'::jsonb);
  end if;
end $$;

notify pgrst, 'reload schema';
