-- Configura subscription_plan_services pra marcar "1 Corte" e "2 Barba"
-- como 100% (gratis no plano) nos planos que devem cobri-los.
--
-- ESTRATEGIA (autonoma, baseada no nome do plano):
--   * Plano que tem "corte" no nome (case-insensitive) -> Corte a 100%
--   * Plano que tem "barba" no nome (case-insensitive) -> Barba a 100%
--   * Sobrancelha NAO e configurada aqui — deixe via painel se quiser
--     desconto especifico. Sem config, ela cai no desconto geral do plano.
--
-- USO:
--   1. Rode BLOCO 1 (SELECT) e confira que os planos vao ser alterados como esperado.
--   2. Se OK, rode BLOCO 2 (UPSERT transacional).
--   3. Conferir no painel cada plano.
--
-- SERVICE IDs (extraidos da auditoria anterior):
--   1 Corte:      1936c461-ef66-4ebc-a5b8-9e60a9909ed9
--   2 Barba:      16c4f11e-7606-4837-bcf4-d330c6eced7c
--   4 sobrancelha: a9d64001-8ae2-4248-a1af-c47d5868961d

-- ============================================================
-- BLOCO 1: PREVIEW — o que vai acontecer?
-- ============================================================
WITH service_ids AS (
  SELECT
    '1936c461-ef66-4ebc-a5b8-9e60a9909ed9' AS corte_id,
    '16c4f11e-7606-4837-bcf4-d330c6eced7c' AS barba_id
),
plan_targets AS (
  SELECT
    sp.id AS plan_id,
    sp.name AS plano,
    sp."cutsPerMonth" AS cortes,
    sp."discountPercent" AS desconto_geral,
    -- Decide pelos nomes — case-insensitive, ignora acentos basicos
    (sp.name ILIKE '%corte%') AS deve_marcar_corte,
    (sp.name ILIKE '%barba%') AS deve_marcar_barba
  FROM subscription_plans sp
)
SELECT
  pt.plan_id,
  pt.plano,
  pt.cortes,
  pt.desconto_geral,
  CASE WHEN pt.deve_marcar_corte THEN 'sim' ELSE '-' END AS marcar_corte_100,
  CASE WHEN pt.deve_marcar_barba THEN 'sim' ELSE '-' END AS marcar_barba_100,
  -- estado atual
  COALESCE((
    SELECT sps."discountPercent" FROM subscription_plan_services sps
    JOIN service_ids si ON true
    WHERE sps."planId" = pt.plan_id AND sps."serviceId" = si.corte_id
  )::text, 'NAO LISTADO') AS corte_atual,
  COALESCE((
    SELECT sps."discountPercent" FROM subscription_plan_services sps
    JOIN service_ids si ON true
    WHERE sps."planId" = pt.plan_id AND sps."serviceId" = si.barba_id
  )::text, 'NAO LISTADO') AS barba_atual
FROM plan_targets pt
ORDER BY pt.plano;

-- ============================================================
-- BLOCO 2: APLICAR (UPSERT transacional)
-- ============================================================
-- INSERT nos planos que devem cobrir o servico mas nao tem entry, OU
-- UPDATE pra 100% nos que tem entry com % diferente.
-- ID gerado via gen_random_uuid() (pgcrypto/built-in). Se der erro de "function
-- gen_random_uuid does not exist", troca por uuid_generate_v4() ou rode:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- 1 Corte = 100% em todo plano com "corte" no nome
INSERT INTO subscription_plan_services (id, "planId", "serviceId", "discountPercent", "createdAt")
SELECT
  gen_random_uuid(),
  sp.id,
  '1936c461-ef66-4ebc-a5b8-9e60a9909ed9',
  100,
  NOW()
FROM subscription_plans sp
WHERE sp.name ILIKE '%corte%'
  AND NOT EXISTS (
    SELECT 1 FROM subscription_plan_services sps
    WHERE sps."planId" = sp.id
      AND sps."serviceId" = '1936c461-ef66-4ebc-a5b8-9e60a9909ed9'
  );

UPDATE subscription_plan_services sps
SET "discountPercent" = 100
FROM subscription_plans sp
WHERE sps."planId" = sp.id
  AND sp.name ILIKE '%corte%'
  AND sps."serviceId" = '1936c461-ef66-4ebc-a5b8-9e60a9909ed9'
  AND sps."discountPercent" <> 100;

-- 2 Barba = 100% em todo plano com "barba" no nome
INSERT INTO subscription_plan_services (id, "planId", "serviceId", "discountPercent", "createdAt")
SELECT
  gen_random_uuid(),
  sp.id,
  '16c4f11e-7606-4837-bcf4-d330c6eced7c',
  100,
  NOW()
FROM subscription_plans sp
WHERE sp.name ILIKE '%barba%'
  AND NOT EXISTS (
    SELECT 1 FROM subscription_plan_services sps
    WHERE sps."planId" = sp.id
      AND sps."serviceId" = '16c4f11e-7606-4837-bcf4-d330c6eced7c'
  );

UPDATE subscription_plan_services sps
SET "discountPercent" = 100
FROM subscription_plans sp
WHERE sps."planId" = sp.id
  AND sp.name ILIKE '%barba%'
  AND sps."serviceId" = '16c4f11e-7606-4837-bcf4-d330c6eced7c'
  AND sps."discountPercent" <> 100;

-- Verificacao final (executa antes do COMMIT pra conferir)
SELECT
  sp.name AS plano,
  s.name  AS servico,
  sps."discountPercent" AS desconto
FROM subscription_plan_services sps
JOIN subscription_plans sp ON sp.id = sps."planId"
JOIN services s ON s.id = sps."serviceId"
WHERE s.id IN (
  '1936c461-ef66-4ebc-a5b8-9e60a9909ed9',
  '16c4f11e-7606-4837-bcf4-d330c6eced7c'
)
ORDER BY sp.name, s.name;

-- Conferiu? Se sim, COMMIT. Senao, ROLLBACK.
COMMIT;
-- ROLLBACK;
