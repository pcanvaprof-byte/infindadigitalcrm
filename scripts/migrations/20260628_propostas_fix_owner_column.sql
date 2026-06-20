-- Fix: RPC pública usava pr.owner; a coluna real é pr.owner_name

drop function if exists public.get_proposal_by_token(text);
create or replace function public.get_proposal_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'numero', p.numero,
    'titulo', p.titulo,
    'status', p.status,
    'valor_implantacao', p.valor_implantacao,
    'valor_mensal', p.valor_mensal,
    'valor_avulso', p.valor_avulso,
    'validade_dias', p.validade_dias,
    'valid_until', p.valid_until,
    'sent_at', p.sent_at,
    'first_viewed_at', p.first_viewed_at,
    'current_version_id', p.current_version_id,
    'cliente', case when c.id is not null then jsonb_build_object(
      'company', c.company,
      'contact_name', c.contact_name,
      'segment', c.segment,
      'city', c.city,
      'state', c.state
    ) else null end,
    'lead', case when pr.id is not null then jsonb_build_object(
      'company', pr.company,
      'owner', pr.owner_name,
      'segment', pr.segment,
      'city', pr.city,
      'state', pr.state
    ) else null end,
    'versao', case when v.id is not null then jsonb_build_object(
      'version_number', v.version_number,
      'conteudo_json', v.conteudo_json
    ) else null end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome, 'descricao', i.descricao,
        'categoria', i.categoria, 'cobranca', i.cobranca,
        'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
        'valor_total', i.valor_total, 'prazo_dias', i.prazo_dias,
        'entregaveis', i.entregaveis, 'ordem', i.ordem
      ) order by i.ordem)
      from public.proposal_items i where i.proposal_id = p.id
    ), '[]'::jsonb)
  )
  into v
  from public.proposals p
  left join public.clients c on c.id = p.client_id
  left join public.prospects pr on pr.id = p.lead_id
  left join public.proposal_versions v on v.id = p.current_version_id
  where p.token_publico = p_token
  limit 1;
  return v;
end $$;
grant execute on function public.get_proposal_by_token(text) to anon, authenticated;