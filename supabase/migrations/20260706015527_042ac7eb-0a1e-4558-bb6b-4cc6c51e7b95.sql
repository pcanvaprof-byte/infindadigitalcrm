
-- 1) Colunas extras nos packs
alter table public.cad_template_packs add column if not exists objetivo text;
alter table public.cad_template_packs add column if not exists segmento text;
alter table public.cad_template_packs add column if not exists tags text[] not null default array[]::text[];
alter table public.cad_template_packs add column if not exists variables jsonb not null default '["nome","empresa","cidade","segmento","telefone","responsavel","cargo"]'::jsonb;

-- 2) Favoritos por usuário
create table if not exists public.cad_pack_favorites (
  user_id uuid not null,
  pack_key text not null,
  organization_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, pack_key)
);
grant select, insert, delete on public.cad_pack_favorites to authenticated;
grant all on public.cad_pack_favorites to service_role;
alter table public.cad_pack_favorites enable row level security;
drop policy if exists cad_pack_favorites_own on public.cad_pack_favorites;
create policy cad_pack_favorites_own on public.cad_pack_favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3) RPCs de gerenciamento
create or replace function public.cad_toggle_favorite(_pack_key text)
returns boolean language plpgsql security definer set search_path=public as $$
declare _uid uuid := auth.uid(); _found boolean;
begin
  if _uid is null then raise exception 'auth_required'; end if;
  select true into _found from public.cad_pack_favorites where user_id=_uid and pack_key=_pack_key;
  if _found then
    delete from public.cad_pack_favorites where user_id=_uid and pack_key=_pack_key;
    return false;
  end if;
  insert into public.cad_pack_favorites(user_id, pack_key, organization_id)
    values (_uid, _pack_key, public.current_org_id());
  return true;
end$$;
revoke execute on function public.cad_toggle_favorite(text) from public, anon;
grant execute on function public.cad_toggle_favorite(text) to authenticated;

create or replace function public.cad_delete_pack(_pack_key text)
returns boolean language plpgsql security definer set search_path=public as $$
declare _org uuid := public.current_org_id();
begin
  if _org is null then raise exception 'no active org'; end if;
  delete from public.cad_templates where organization_id=_org and pack_key=_pack_key and is_system=false;
  delete from public.cad_template_packs where organization_id=_org and pack_key=_pack_key and is_system=false;
  update public.organizations set active_template_pack='default'
    where id=_org and active_template_pack=_pack_key;
  return true;
end$$;
revoke execute on function public.cad_delete_pack(text) from public, anon;
grant execute on function public.cad_delete_pack(text) to authenticated;

create or replace function public.cad_update_pack_meta(
  _pack_key text, _nome text, _descricao text, _categoria text,
  _icon text, _objetivo text, _segmento text, _tags text[]
) returns boolean language plpgsql security definer set search_path=public as $$
declare _org uuid := public.current_org_id();
begin
  if _org is null then raise exception 'no active org'; end if;
  update public.cad_template_packs set
    nome = coalesce(nullif(_nome,''), nome),
    descricao = _descricao,
    categoria = coalesce(nullif(_categoria,''), categoria),
    icon = coalesce(nullif(_icon,''), icon),
    objetivo = _objetivo,
    segmento = _segmento,
    tags = coalesce(_tags, tags),
    updated_at = now()
   where organization_id=_org and pack_key=_pack_key and is_system=false;
  if not found then raise exception 'pack não editável (system ou inexistente)'; end if;
  return true;
end$$;
revoke execute on function public.cad_update_pack_meta(text,text,text,text,text,text,text,text[]) from public, anon;
grant execute on function public.cad_update_pack_meta(text,text,text,text,text,text,text,text[]) to authenticated;

create or replace function public.cad_upsert_template(
  _pack_key text, _stage public.cad_stage, _titulo text, _corpo text
) returns void language plpgsql security definer set search_path=public as $$
declare _org uuid := public.current_org_id();
begin
  if _org is null then raise exception 'no active org'; end if;
  if not exists (select 1 from public.cad_template_packs where organization_id=_org and pack_key=_pack_key) then
    insert into public.cad_template_packs (pack_key, nome, descricao, categoria, icon, is_system, organization_id, objetivo, segmento, tags)
    select pack_key, nome, descricao, categoria, icon, false, _org, objetivo, segmento, tags
      from public.cad_template_packs where is_system and pack_key=_pack_key
    on conflict do nothing;
  end if;
  insert into public.cad_templates (organization_id, pack_key, stage, titulo, corpo, is_system)
  values (_org, _pack_key, _stage, coalesce(_titulo,''), coalesce(_corpo,''), false)
  on conflict (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), pack_key, stage)
  do update set titulo = excluded.titulo, corpo = excluded.corpo, updated_at = now();
end$$;
revoke execute on function public.cad_upsert_template(text,public.cad_stage,text,text) from public, anon;
grant execute on function public.cad_upsert_template(text,public.cad_stage,text,text) to authenticated;

-- Estender cad_list_packs para trazer novos campos + favorito
drop function if exists public.cad_list_packs();
create or replace function public.cad_list_packs()
returns table(
  pack_key text, nome text, descricao text, categoria text, icon text,
  is_system boolean, is_active boolean, template_count integer,
  is_favorite boolean, objetivo text, segmento text, tags text[]
) language plpgsql stable security definer set search_path=public as $$
declare _org uuid := public.current_org_id(); _active text; _uid uuid := auth.uid();
begin
  select active_template_pack into _active from public.organizations where id=_org;
  return query
  select p.pack_key, p.nome, p.descricao, p.categoria, p.icon, p.is_system,
    (p.pack_key = coalesce(_active,'default')) as is_active,
    (select count(*)::int from public.cad_templates t
       where t.pack_key=p.pack_key and (t.is_system or t.organization_id=_org)),
    exists(select 1 from public.cad_pack_favorites f where f.user_id=_uid and f.pack_key=p.pack_key) as is_favorite,
    p.objetivo, p.segmento, p.tags
  from public.cad_template_packs p
  where p.is_system or p.organization_id=_org
  order by p.is_system desc, p.categoria, p.nome;
end$$;
revoke execute on function public.cad_list_packs() from public, anon;
grant execute on function public.cad_list_packs() to authenticated;

-- 4) Helper de seed
create or replace function public._cad_seed_system_pack(
  _pack_key text, _nome text, _descricao text, _categoria text, _icon text,
  _objetivo text, _segmento text, _tags text[],
  _openers jsonb  -- {stage: {titulo, corpo}, ...}
) returns void language plpgsql set search_path=public as $$
declare _s text; _titulo text; _corpo text; _stages text[] := array[
  'followup_1','followup_2','followup_3','followup_4','followup_5','followup_6','followup_7',
  'interessado','reuniao_agendada','proposta_enviada','negociacao','fechado','perdido'];
begin
  insert into public.cad_template_packs (pack_key, nome, descricao, categoria, icon, is_system, organization_id, objetivo, segmento, tags)
  values (_pack_key, _nome, _descricao, _categoria, _icon, true, null, _objetivo, _segmento, coalesce(_tags, array[]::text[]))
  on conflict do nothing;

  foreach _s in array _stages loop
    _titulo := coalesce(_openers->_s->>'titulo', 'Mensagem — '||_s);
    _corpo  := coalesce(_openers->_s->>'corpo',  'Olá {{responsavel}}, tudo bem? Sobre a {{empresa}}...');
    insert into public.cad_templates (organization_id, pack_key, stage, titulo, corpo, is_system)
    values (null, _pack_key, _s::public.cad_stage, _titulo, _corpo, true)
    on conflict (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid), pack_key, stage) do nothing;
  end loop;
end$$;

-- 5) Seed dos 12 packs novos por segmento
select public._cad_seed_system_pack(
  'saude_clinicas', 'Saúde — Clínicas', 'Cadência para clínicas, consultórios e centros médicos', 'saude', 'HeartPulse',
  'Conquistar clínicas que querem lotar agenda com marketing digital', 'Saúde',
  array['saúde','clínica','médico','agenda','pacientes'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem inicial — Saúde',
      'corpo', 'Olá Dr(a). {{responsavel}}! Vi a {{empresa}} em {{cidade}} e ajudei clínicas parecidas a lotarem a agenda com Google e Instagram. Posso te mostrar como?'),
    'followup_2', jsonb_build_object('titulo','FU 2 — Pacientes qualificados',
      'corpo', 'Dr(a). {{responsavel}}, o problema hoje não é falta de paciente — é atrair o paciente certo. Consigo mostrar em 15min o que estamos fazendo com outras clínicas.'),
    'followup_3', jsonb_build_object('titulo','FU 3 — Caso',
      'corpo', 'Dr(a). {{responsavel}}, uma clínica do porte da {{empresa}} passou de 40 para 120 agendamentos/mês em 90 dias. Faz sentido conversar?'),
    'followup_4', jsonb_build_object('titulo','FU 4 — Autoridade digital',
      'corpo', '{{responsavel}}, presença digital de clínica hoje = autoridade. Sem isso, o paciente escolhe o concorrente. Posso te mandar um diagnóstico rápido?'),
    'followup_5', jsonb_build_object('titulo','FU 5 — Convite',
      'corpo', '{{responsavel}}, 20 minutos essa semana pra eu te mostrar como podemos posicionar a {{empresa}} como referência em {{cidade}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6 — Última tentativa',
      'corpo', 'Dr(a). {{responsavel}}, última tentativa por aqui. Se fizer sentido em algum momento falarmos sobre encher agenda com previsibilidade, estou à disposição.'),
    'followup_7', jsonb_build_object('titulo','FU 7 — Encerramento',
      'corpo', 'Dr(a). {{responsavel}}, encerro meus contatos por aqui. Sucesso à {{empresa}} — qualquer coisa, é só chamar.'),
    'interessado', jsonb_build_object('titulo','Interessado', 'corpo','Que bom, Dr(a). {{responsavel}}! Vou te mandar horários para conversarmos sobre a {{empresa}}.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião confirmada', 'corpo','Só confirmando nossa call sobre a {{empresa}}. Qualquer ajuste, me avisa.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta enviada', 'corpo','Dr(a). {{responsavel}}, enviei a proposta. Alguma dúvida? Posso te ligar?'),
    'negociacao', jsonb_build_object('titulo','Negociação', 'corpo','Conseguimos fechar os pontos pendentes da proposta da {{empresa}}?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas', 'corpo','Bem-vindo(a) Dr(a). {{responsavel}}! Vamos começar os trabalhos da {{empresa}}.'),
    'perdido', jsonb_build_object('titulo','Perdido', 'corpo','Obrigado pelo retorno, Dr(a). {{responsavel}}. Fico à disposição futuramente.')
  )
);

select public._cad_seed_system_pack(
  'odontologia', 'Odontologia', 'Cadência para clínicas odontológicas e dentistas', 'odontologia', 'Smile',
  'Encher agenda de clínica odontológica com pacientes qualificados', 'Odontologia',
  array['dentista','odontologia','estética','implante'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Odonto',
      'corpo', 'Olá Dr(a). {{responsavel}}! Ajudo clínicas odontológicas a atrair pacientes de alto ticket (implante, lente, estética). Posso te mostrar como aplicamos na {{empresa}}?'),
    'followup_2', jsonb_build_object('titulo','FU 2 — Ticket alto', 'corpo','Dr(a). {{responsavel}}, o segredo hoje é atrair paciente disposto a pagar bem — não desconto. Posso te mostrar como estamos fazendo isso.'),
    'followup_3', jsonb_build_object('titulo','FU 3 — Caso odonto', 'corpo','Clínica em {{cidade}} passou de R$ 40k para R$ 180k/mês em implantes usando o método. Posso te enviar o case da {{empresa}}?'),
    'followup_4', jsonb_build_object('titulo','FU 4 — Instagram + Google', 'corpo','{{responsavel}}, hoje seu paciente pesquisa você antes de ligar. Vamos deixar a {{empresa}} imbatível no Google e no Instagram?'),
    'followup_5', jsonb_build_object('titulo','FU 5 — Convite', 'corpo','Dr(a). {{responsavel}}, 20min pra eu mostrar o plano de crescimento pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6 — Última', 'corpo','Última tentativa por aqui, Dr(a). {{responsavel}}. Se quiser conversar depois, fico à disposição.'),
    'followup_7', jsonb_build_object('titulo','FU 7 — Encerramento', 'corpo','Encerro por aqui, Dr(a). {{responsavel}}. Sucesso à {{empresa}}!'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo, Dr(a). {{responsavel}}! Vou te enviar horários.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando nossa conversa sobre a {{empresa}}. Qualquer ajuste, me avisa.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Dr(a). {{responsavel}}, mandei a proposta. Podemos falar hoje?'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes da proposta da {{empresa}}?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a) Dr(a). {{responsavel}}! Vamos começar!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Agradeço o retorno. Fico à disposição.')
  )
);

select public._cad_seed_system_pack(
  'contabilidade', 'Contabilidade', 'Cadência para escritórios de contabilidade', 'contabilidade', 'Calculator',
  'Prospectar escritórios contábeis que querem digitalizar captação', 'Contabilidade',
  array['contabilidade','contador','escritório'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Contabilidade',
      'corpo', 'Olá {{responsavel}}! Ajudo escritórios contábeis como a {{empresa}} a captarem clientes recorrentes com marketing digital. Posso te mostrar?'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, indicação é ótimo, mas não escala. Posso te mostrar como estamos captando clientes previsíveis para escritórios como a {{empresa}}?'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, um escritório em {{cidade}} triplicou a base de MEIs em 6 meses com nosso método. Posso compartilhar?'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra automatizar prospecção e nutrição de leads pra {{empresa}}. Isso libera o time contábil pra o que gera receita.'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','{{responsavel}}, 20min pra eu te mostrar o plano de captação para a {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa, {{responsavel}}. Se quiser falar depois, é só me chamar.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui, {{responsavel}}. Sucesso à {{empresa}}.'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo! Vou te mandar horários.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando nossa call sobre a {{empresa}}.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta, {{responsavel}}. Podemos falar hoje?'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a) {{responsavel}}!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'imobiliaria', 'Imobiliárias & Corretores', 'Cadência para imobiliárias e corretores autônomos', 'imobiliaria', 'Home',
  'Prospectar imobiliárias que querem mais leads qualificados', 'Imobiliário',
  array['imobiliária','corretor','imóveis','leads'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Imobiliária',
      'corpo','Olá {{responsavel}}! Ajudo imobiliárias como a {{empresa}} em {{cidade}} a gerar leads de compradores qualificados. Posso te mostrar como?'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, portais são caros e o lead vai também pros concorrentes. Consigo mostrar como gerar leads exclusivos pra {{empresa}}.'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, uma imobiliária em {{cidade}} vendeu 8 imóveis num mês só de tráfego pago. Compartilho o case?'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra automatizar o atendimento e qualificar o lead antes de chegar no corretor. Faz sentido pra {{empresa}}?'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','20 min pra eu te mostrar o plano pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa, {{responsavel}}.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui. Sucesso!'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo! Vou te mandar horários.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando nossa call.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta.'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a)!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'academia', 'Academias & Studios', 'Cadência para academias, crossfit, pilates e studios', 'academia', 'Dumbbell',
  'Aumentar matrículas recorrentes em academias e studios', 'Fitness',
  array['academia','fitness','crossfit','pilates','matrículas'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Academia',
      'corpo','Olá {{responsavel}}! Ajudo academias e studios como a {{empresa}} em {{cidade}} a lotar aula com marketing local. Posso te mostrar?'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, matrícula sem estratégia digital hoje é loteria. Dá pra ter previsibilidade — quer ver como?'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, studio em {{cidade}} fez 80 novas matrículas em 30 dias com nosso método.'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra automatizar aula experimental e follow-up de aluno inativo pra {{empresa}}.'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','20min pra te mostrar o plano de matrículas pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa por aqui.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui. Sucesso à {{empresa}}!'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo! Horários chegando.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando nossa call.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta.'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a)!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'loja_infantil', 'Loja Infantil', 'Cadência para lojas infantis físicas e online', 'loja_infantil', 'Baby',
  'Aumentar vendas de lojas infantis pelo digital', 'Varejo Infantil',
  array['loja','infantil','crianças','varejo'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Loja Infantil',
      'corpo','Olá {{responsavel}}! Ajudo lojas infantis como a {{empresa}} em {{cidade}} a vender mais no Instagram e no WhatsApp. Posso te mostrar?'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, sem tráfego pago hoje seu Instagram entrega quase nada. Consigo mudar isso pra {{empresa}}.'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, uma loja infantil em {{cidade}} triplicou vendas em 90 dias. Compartilho?'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra automatizar carrinho abandonado e recomprar cliente antigo da {{empresa}}.'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','20min pra eu te mostrar o plano pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui.'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Que bom! Horários chegando.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta.'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a)!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'concessionaria', 'Concessionárias & Revendas', 'Cadência para concessionárias e revendas de veículos', 'concessionaria', 'Car',
  'Gerar leads qualificados para test-drive e vendas', 'Automotivo',
  array['carros','veículos','concessionária','test-drive'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Concessionária',
      'corpo','Olá {{responsavel}}! Ajudo concessionárias como a {{empresa}} em {{cidade}} a agendar mais test-drives com leads qualificados. Posso te mostrar?'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, lead frio virou padrão do setor — consigo te levar comprador pronto pra {{empresa}}.'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, revenda em {{cidade}} passou de 30 pra 90 test-drives/mês. Compartilho o case?'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra automatizar qualificação e passar ao vendedor só quem tem chance real de fechar.'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','20min pra te mostrar o plano pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui.'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo! Horários chegando.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta.'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a)!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'b2b_saas', 'B2B SaaS', 'Cadência consultiva para prospecção B2B / SaaS', 'b2b', 'Briefcase',
  'Abordar empresas B2B com foco em ROI e produtividade', 'B2B',
  array['b2b','saas','empresas','vendas'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — B2B',
      'corpo','Olá {{responsavel}}! Vi a {{empresa}} e ajudo empresas do seu porte a reduzir custo de aquisição com marketing e automação. Posso compartilhar como aplicamos no seu setor?'),
    'followup_2', jsonb_build_object('titulo','FU 2 — Diagnóstico','corpo','{{responsavel}}, olhei rápido a operação da {{empresa}} e vi 3 pontos que podem estar puxando o CAC pra cima. Te mando um resumo?'),
    'followup_3', jsonb_build_object('titulo','FU 3 — ROI','corpo','{{responsavel}}, empresa parecida com a {{empresa}} reduziu 38% no CAC em 90 dias. Faz sentido conversarmos?'),
    'followup_4', jsonb_build_object('titulo','FU 4 — Estratégico','corpo','{{responsavel}}, sem automação estruturada, seu time comercial gasta 60% do tempo com lead ruim. Dá pra reverter isso.'),
    'followup_5', jsonb_build_object('titulo','FU 5 — Convite','corpo','{{responsavel}}, 25min essa semana pra eu te mostrar o mapa aplicado à {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6 — Última','corpo','{{responsavel}}, encerro os contatos ativos. Se quiser conversar depois, é só chamar.'),
    'followup_7', jsonb_build_object('titulo','FU 7 — Encerramento','corpo','Sucesso à {{empresa}}, {{responsavel}}.'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo, {{responsavel}}! Vou te enviar horários.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando nossa call sobre a {{empresa}}.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta, {{responsavel}}. Podemos falar hoje?'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes da proposta da {{empresa}}?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a), {{responsavel}}!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'restaurante_delivery', 'Restaurantes & Delivery', 'Cadência para restaurantes, pizzarias e delivery', 'restaurante', 'UtensilsCrossed',
  'Aumentar pedidos e clientes recorrentes', 'Alimentação',
  array['restaurante','delivery','pizza','ifood'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Restaurante',
      'corpo','Olá {{responsavel}}! Ajudo restaurantes como a {{empresa}} em {{cidade}} a vender mais no delivery e no salão sem depender só do iFood.'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, depender só de marketplace é caro. Consigo mostrar como criar canal próprio pra {{empresa}}.'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, restaurante em {{cidade}} dobrou pedidos diretos em 60 dias. Compartilho?'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra recomprar cliente e lotar horário morto da {{empresa}} com automação.'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','20min pra te mostrar o plano pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui.'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo! Horários chegando.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta.'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a)!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'estetica', 'Estética & Beleza', 'Cadência para clínicas de estética e salões', 'estetica', 'Sparkles',
  'Encher agenda de procedimentos estéticos com clientes de ticket alto', 'Estética',
  array['estética','beleza','salão','clínica'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Estética',
      'corpo','Olá {{responsavel}}! Ajudo clínicas de estética como a {{empresa}} a lotar agenda de procedimentos de ticket alto. Posso te mostrar como?'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, hoje sua cliente pesquisa antes de agendar. Vamos deixar a {{empresa}} imbatível no Google e Instagram?'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, clínica em {{cidade}} passou de 30 pra 90 procedimentos/mês em 90 dias.'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra automatizar retorno de cliente e nutrição de leads pra {{empresa}}.'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','20min pra te mostrar o plano pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui.'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo! Horários chegando.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta.'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a)!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'educacao', 'Educação & Cursos', 'Cadência para escolas, cursos livres e infoprodutos', 'educacao', 'GraduationCap',
  'Aumentar matrículas em escolas e cursos', 'Educação',
  array['educação','escola','curso','matrículas'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Educação',
      'corpo','Olá {{responsavel}}! Ajudo escolas e cursos como a {{empresa}} em {{cidade}} a bater meta de matrículas com marketing digital estruturado.'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, matrícula é sazonal — sem funil pronto você perde a janela. Posso te mostrar como.'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, escola em {{cidade}} dobrou matrículas no ciclo com nosso método.'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra automatizar visita, matrícula online e retenção pra {{empresa}}.'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','20min pra te mostrar o plano pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui.'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo! Horários chegando.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta.'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a)!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);

select public._cad_seed_system_pack(
  'petshop', 'Pet Shop & Veterinária', 'Cadência para pet shops, banho & tosa e clínicas veterinárias', 'petshop', 'PawPrint',
  'Aumentar recorrência de banho, tosa e consultas veterinárias', 'Pet',
  array['pet','veterinária','banho','tosa'],
  jsonb_build_object(
    'followup_1', jsonb_build_object('titulo','Abordagem — Pet',
      'corpo','Olá {{responsavel}}! Ajudo pet shops e clínicas veterinárias como a {{empresa}} em {{cidade}} a criar recorrência de tutores. Posso te mostrar?'),
    'followup_2', jsonb_build_object('titulo','FU 2','corpo','{{responsavel}}, tutor fiel = LTV alto. Dá pra automatizar lembrete de banho, vacina e retorno pra {{empresa}}.'),
    'followup_3', jsonb_build_object('titulo','FU 3','corpo','{{responsavel}}, pet shop em {{cidade}} cresceu 60% em 90 dias com nosso método.'),
    'followup_4', jsonb_build_object('titulo','FU 4','corpo','{{responsavel}}, dá pra atrair tutor novo pelo Instagram sem depender de indicação.'),
    'followup_5', jsonb_build_object('titulo','FU 5','corpo','20min pra te mostrar o plano pra {{empresa}}?'),
    'followup_6', jsonb_build_object('titulo','FU 6','corpo','Última tentativa.'),
    'followup_7', jsonb_build_object('titulo','FU 7','corpo','Encerro por aqui.'),
    'interessado', jsonb_build_object('titulo','Interessado','corpo','Ótimo! Horários chegando.'),
    'reuniao_agendada', jsonb_build_object('titulo','Reunião','corpo','Confirmando.'),
    'proposta_enviada', jsonb_build_object('titulo','Proposta','corpo','Enviei a proposta.'),
    'negociacao', jsonb_build_object('titulo','Negociação','corpo','Fechamos os ajustes?'),
    'fechado', jsonb_build_object('titulo','Boas-vindas','corpo','Bem-vindo(a)!'),
    'perdido', jsonb_build_object('titulo','Perdido','corpo','Obrigado pelo retorno.')
  )
);
