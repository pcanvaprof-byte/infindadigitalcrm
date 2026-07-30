-- Conferencia: contagens do dashboard x dados reais, por papel
-- Rode no SQL editor do projeto de producao.

-- 1) Clientes por organizacao (verdade bruta)
select o.id, o.name,
       count(c.*) filter (where true) as clientes_total,
       count(c.*) filter (where c.user_id is null) as clientes_sem_dono
from organizations o
left join clients c on c.organization_id = o.id
group by o.id, o.name
order by clientes_total desc;

-- 2) Clientes por dono (o que um Member deveria ver)
select organization_id, user_id, count(*) as clientes
from clients group by 1,2 order by 1,3 desc;

-- 3) View usada pelo dashboard (deve bater com 1 para owner/admin e com 2 para member)
--    Rode logado como cada usuario (impersonacao via app) e compare:
-- select count(*) from public.v_clients_scoped;

-- 4) Workspaces (organizacoes) e membros
select o.id, o.name, count(m.*) as membros,
       count(*) filter (where m.role = 'owner') as owners,
       count(*) filter (where m.role = 'admin') as admins,
       count(*) filter (where m.role = 'member') as members
from organizations o
left join organization_members m on m.organization_id = o.id
group by o.id, o.name order by membros desc;

-- 5) Trials / acessos (base do painel /usuarios)
select organization_id, access_type, status,
       count(*) as usuarios,
       count(*) filter (where expires_at is not null and expires_at < now()) as expirados,
       count(*) filter (where expires_at is not null and expires_at >= now()) as vigentes
from user_access group by 1,2,3 order by 1,2;

-- 6) Usuarios sem registro de acesso (ficam fora das contagens do painel)
select m.organization_id, m.user_id, m.role
from organization_members m
left join user_access ua
  on ua.user_id = m.user_id and ua.organization_id = m.organization_id
where ua.user_id is null;
