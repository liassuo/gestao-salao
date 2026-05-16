-- Normalizacao de emails: lowercase + trim, com check constraint pra
-- forcar a invariante nas tabelas `clients` e `users`. Pareado com a
-- normalizacao server-side no insert/update.
--
-- Antes de rodar: confirme que nao ha duplicados que so diferem em case
-- (queries abaixo). Se houver, consolide manualmente antes do UPDATE,
-- senao a unique constraint `*_email_key` vai bloquear o lower().

-- ============================================================
-- 1. AUDITORIA (rodar antes pra ver se ha trabalho manual)
-- ============================================================

-- Clients duplicados por case
select lower(trim(email)) as canonical, count(*) as qtd, array_agg(id) as ids
from clients
where email is not null
group by lower(trim(email))
having count(*) > 1;

-- Users duplicados por case
select lower(trim(email)) as canonical, count(*) as qtd, array_agg(id) as ids
from users
where email is not null
group by lower(trim(email))
having count(*) > 1;

-- Quantos registros precisam ser normalizados (rodar antes)
select 'clients' as tabela, count(*) as linhas_para_normalizar
from clients
where email is not null and email <> lower(trim(email))
union all
select 'users', count(*)
from users
where email is not null and email <> lower(trim(email));


-- ============================================================
-- 2. NORMALIZACAO (rodar quando a auditoria voltar limpa)
-- ============================================================

begin;

update clients
set email = lower(trim(email)),
    "updatedAt" = now()
where email is not null and email <> lower(trim(email));

update users
set email = lower(trim(email)),
    "updatedAt" = now()
where email is not null and email <> lower(trim(email));

commit;


-- ============================================================
-- 3. CHECK CONSTRAINT (opcional mas recomendado pra travar a invariante)
-- ============================================================
-- Garante que emails so sao gravados em forma canonica. Se algum
-- caminho server-side esquecer de normalizar, o INSERT estoura aqui
-- em vez de criar dado inconsistente.

alter table clients
  add constraint clients_email_lowercase check (email is null or email = lower(trim(email)));

alter table users
  add constraint users_email_lowercase check (email is null or email = lower(trim(email)));
