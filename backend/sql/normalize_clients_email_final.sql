-- ============================================================
-- NORMALIZACAO DE EMAILS DE CLIENTES — RODADA FINAL
-- ============================================================
-- Faz, em UMA unica transacao:
--   1. Deleta os 7 clientes duplicados restantes (todos sem atividade —
--      0 agendamentos, 0 comandas, 0 pagamentos, 0 dividas, 0 assinaturas).
--      Mantemos a versao que tem historico. Por seguranca, ainda rodamos
--      UPDATEs nas tabelas filhas — sao no-ops mas garantem que qualquer
--      linha "esquecida" criada entre o diagnostico e o apply seja movida.
--   2. Normaliza email pra lowercase em TODOS os clientes restantes.
--
-- Se algum passo falhar, ROLLBACK desfaz tudo. Seguro.
--
-- Apos esse SQL: nenhum cliente fica com email em case misturado, e o login
-- volta a funcionar via `eq('email', ...)` mesmo no codigo antigo (o `ilike`
-- continua como defesa em profundidade pra novos casos).

BEGIN;

-- ────────────────────────────────────────────────────────────
-- PARTE 1: REMOVER OS 7 DUPLICADOS SEM ATIVIDADE
-- ────────────────────────────────────────────────────────────
-- Para cada par, manter o WINNER (tem historico) e remover o LOSER (zero).
-- Os UPDATEs sao defensivos: pra cobrir qualquer FK criada entre o
-- diagnostico e o apply (improvavel mas barato).
--
-- email_normalizado                       | WINNER (mantem)                          | LOSER (deleta)
-- --------------------------------------- | ---------------------------------------- | ----------------------------------------
-- daniel.advocacia.tribunais@gmail.com    | e9f5f3e4-265a-4539-b147-9ef5923ffa48     | 1ceae0ba-55c1-485b-9d61-575aec7e0877
-- dediih22@gmail.com                      | ba746cd7-67c2-4b6f-9d2b-6fd3e3545a27     | 78d4baae-8e3f-4b37-870d-eefe03bf0d58
-- edianemaciel06@gmail.com                | 02d1f3f7-d504-45b9-88b1-8a73d9fa4a78     | 28ddde73-db87-42ef-b860-bc9c5a995bad
-- gabrielasilvacastro212023@gmail.com     | 58c3fab2-0813-4cdb-9437-8432eccdd3ca     | 6bc48af8-4070-4475-b165-44c9cb45a4b4
-- hugobizzotto01@gmail.com                | 1d6bd574-1460-49e4-920d-3c62b5fbd5cf     | 50b6d887-1037-4cc8-ba08-b383702fb17b
-- jabadehant@yahoo.com.br                 | c1a3d4aa-8b11-4a50-b4e7-4e6fe25b1e09     | cf49078e-45ca-4d89-a883-7916cd56136b
-- joaoneto.123gouf@gmail.com              | d8bb8755-f632-4592-a832-df5707ab128c     | 8c8f14a6-21e9-4e8a-b935-479fc1d585be

WITH pares (winner_id, loser_id) AS (
  VALUES
    ('e9f5f3e4-265a-4539-b147-9ef5923ffa48'::text, '1ceae0ba-55c1-485b-9d61-575aec7e0877'::text),
    ('ba746cd7-67c2-4b6f-9d2b-6fd3e3545a27'::text, '78d4baae-8e3f-4b37-870d-eefe03bf0d58'::text),
    ('02d1f3f7-d504-45b9-88b1-8a73d9fa4a78'::text, '28ddde73-db87-42ef-b860-bc9c5a995bad'::text),
    ('58c3fab2-0813-4cdb-9437-8432eccdd3ca'::text, '6bc48af8-4070-4475-b165-44c9cb45a4b4'::text),
    ('1d6bd574-1460-49e4-920d-3c62b5fbd5cf'::text, '50b6d887-1037-4cc8-ba08-b383702fb17b'::text),
    ('c1a3d4aa-8b11-4a50-b4e7-4e6fe25b1e09'::text, 'cf49078e-45ca-4d89-a883-7916cd56136b'::text),
    ('d8bb8755-f632-4592-a832-df5707ab128c'::text, '8c8f14a6-21e9-4e8a-b935-479fc1d585be'::text)
)
UPDATE appointments SET "clientId" = p.winner_id, "updatedAt" = NOW()
FROM pares p WHERE appointments."clientId" = p.loser_id;

WITH pares (winner_id, loser_id) AS (
  VALUES
    ('e9f5f3e4-265a-4539-b147-9ef5923ffa48'::text, '1ceae0ba-55c1-485b-9d61-575aec7e0877'::text),
    ('ba746cd7-67c2-4b6f-9d2b-6fd3e3545a27'::text, '78d4baae-8e3f-4b37-870d-eefe03bf0d58'::text),
    ('02d1f3f7-d504-45b9-88b1-8a73d9fa4a78'::text, '28ddde73-db87-42ef-b860-bc9c5a995bad'::text),
    ('58c3fab2-0813-4cdb-9437-8432eccdd3ca'::text, '6bc48af8-4070-4475-b165-44c9cb45a4b4'::text),
    ('1d6bd574-1460-49e4-920d-3c62b5fbd5cf'::text, '50b6d887-1037-4cc8-ba08-b383702fb17b'::text),
    ('c1a3d4aa-8b11-4a50-b4e7-4e6fe25b1e09'::text, 'cf49078e-45ca-4d89-a883-7916cd56136b'::text),
    ('d8bb8755-f632-4592-a832-df5707ab128c'::text, '8c8f14a6-21e9-4e8a-b935-479fc1d585be'::text)
)
UPDATE orders SET "clientId" = p.winner_id, "updatedAt" = NOW()
FROM pares p WHERE orders."clientId" = p.loser_id;

WITH pares (winner_id, loser_id) AS (
  VALUES
    ('e9f5f3e4-265a-4539-b147-9ef5923ffa48'::text, '1ceae0ba-55c1-485b-9d61-575aec7e0877'::text),
    ('ba746cd7-67c2-4b6f-9d2b-6fd3e3545a27'::text, '78d4baae-8e3f-4b37-870d-eefe03bf0d58'::text),
    ('02d1f3f7-d504-45b9-88b1-8a73d9fa4a78'::text, '28ddde73-db87-42ef-b860-bc9c5a995bad'::text),
    ('58c3fab2-0813-4cdb-9437-8432eccdd3ca'::text, '6bc48af8-4070-4475-b165-44c9cb45a4b4'::text),
    ('1d6bd574-1460-49e4-920d-3c62b5fbd5cf'::text, '50b6d887-1037-4cc8-ba08-b383702fb17b'::text),
    ('c1a3d4aa-8b11-4a50-b4e7-4e6fe25b1e09'::text, 'cf49078e-45ca-4d89-a883-7916cd56136b'::text),
    ('d8bb8755-f632-4592-a832-df5707ab128c'::text, '8c8f14a6-21e9-4e8a-b935-479fc1d585be'::text)
)
UPDATE payments SET "clientId" = p.winner_id, "updatedAt" = NOW()
FROM pares p WHERE payments."clientId" = p.loser_id;

WITH pares (winner_id, loser_id) AS (
  VALUES
    ('e9f5f3e4-265a-4539-b147-9ef5923ffa48'::text, '1ceae0ba-55c1-485b-9d61-575aec7e0877'::text),
    ('ba746cd7-67c2-4b6f-9d2b-6fd3e3545a27'::text, '78d4baae-8e3f-4b37-870d-eefe03bf0d58'::text),
    ('02d1f3f7-d504-45b9-88b1-8a73d9fa4a78'::text, '28ddde73-db87-42ef-b860-bc9c5a995bad'::text),
    ('58c3fab2-0813-4cdb-9437-8432eccdd3ca'::text, '6bc48af8-4070-4475-b165-44c9cb45a4b4'::text),
    ('1d6bd574-1460-49e4-920d-3c62b5fbd5cf'::text, '50b6d887-1037-4cc8-ba08-b383702fb17b'::text),
    ('c1a3d4aa-8b11-4a50-b4e7-4e6fe25b1e09'::text, 'cf49078e-45ca-4d89-a883-7916cd56136b'::text),
    ('d8bb8755-f632-4592-a832-df5707ab128c'::text, '8c8f14a6-21e9-4e8a-b935-479fc1d585be'::text)
)
UPDATE debts SET "clientId" = p.winner_id, "updatedAt" = NOW()
FROM pares p WHERE debts."clientId" = p.loser_id;

WITH pares (winner_id, loser_id) AS (
  VALUES
    ('e9f5f3e4-265a-4539-b147-9ef5923ffa48'::text, '1ceae0ba-55c1-485b-9d61-575aec7e0877'::text),
    ('ba746cd7-67c2-4b6f-9d2b-6fd3e3545a27'::text, '78d4baae-8e3f-4b37-870d-eefe03bf0d58'::text),
    ('02d1f3f7-d504-45b9-88b1-8a73d9fa4a78'::text, '28ddde73-db87-42ef-b860-bc9c5a995bad'::text),
    ('58c3fab2-0813-4cdb-9437-8432eccdd3ca'::text, '6bc48af8-4070-4475-b165-44c9cb45a4b4'::text),
    ('1d6bd574-1460-49e4-920d-3c62b5fbd5cf'::text, '50b6d887-1037-4cc8-ba08-b383702fb17b'::text),
    ('c1a3d4aa-8b11-4a50-b4e7-4e6fe25b1e09'::text, 'cf49078e-45ca-4d89-a883-7916cd56136b'::text),
    ('d8bb8755-f632-4592-a832-df5707ab128c'::text, '8c8f14a6-21e9-4e8a-b935-479fc1d585be'::text)
)
UPDATE client_subscriptions SET "clientId" = p.winner_id, "updatedAt" = NOW()
FROM pares p WHERE client_subscriptions."clientId" = p.loser_id;

-- Por fim, deleta os 7 losers em um shot
DELETE FROM clients
WHERE id IN (
  '1ceae0ba-55c1-485b-9d61-575aec7e0877',
  '78d4baae-8e3f-4b37-870d-eefe03bf0d58',
  '28ddde73-db87-42ef-b860-bc9c5a995bad',
  '6bc48af8-4070-4475-b165-44c9cb45a4b4',
  '50b6d887-1037-4cc8-ba08-b383702fb17b',
  'cf49078e-45ca-4d89-a883-7916cd56136b',
  '8c8f14a6-21e9-4e8a-b935-479fc1d585be'
)
RETURNING id, name, email;

-- ────────────────────────────────────────────────────────────
-- PARTE 2: NORMALIZAR EMAIL PRA LOWERCASE EM TODOS QUE SOBRARAM
-- ────────────────────────────────────────────────────────────
UPDATE clients
SET email      = lower(trim(email)),
    "updatedAt" = NOW()
WHERE email IS NOT NULL
  AND email <> lower(trim(email));

-- ────────────────────────────────────────────────────────────
-- PARTE 3: VERIFICACAO FINAL — deve retornar 0
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE pendentes INT;
BEGIN
  SELECT COUNT(*) INTO pendentes
  FROM clients
  WHERE email IS NOT NULL AND email <> lower(trim(email));
  IF pendentes > 0 THEN
    RAISE EXCEPTION 'Ainda sobraram % clientes com email nao normalizado.', pendentes;
  END IF;

  SELECT COUNT(*) INTO pendentes FROM (
    SELECT lower(trim(email)) FROM clients
    WHERE email IS NOT NULL
    GROUP BY lower(trim(email)) HAVING COUNT(*) > 1
  ) AS dup;
  IF pendentes > 0 THEN
    RAISE EXCEPTION 'Ainda sobraram % conflitos de duplicidade.', pendentes;
  END IF;
END $$;

COMMIT;
