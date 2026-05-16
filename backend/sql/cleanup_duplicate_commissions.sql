-- Remove comissões PENDING duplicadas: mantém apenas a mais recente
-- por (professionalId, periodStart, periodEnd). Comissões PAID ficam intactas.
--
-- Use após o fix de idempotência em commissions.service.ts.
-- Confira antes com o SELECT; rode o DELETE quando estiver confortável.

-- 1) Confira o que vai ser removido:
WITH ranked AS (
  SELECT
    id,
    "professionalId",
    "periodStart",
    "periodEnd",
    status,
    amount,
    "createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY "professionalId", "periodStart", "periodEnd"
      ORDER BY "createdAt" DESC
    ) AS rn
  FROM commissions
  WHERE status = 'PENDING'
)
SELECT id, "professionalId", "periodStart", "periodEnd", amount, "createdAt"
FROM ranked
WHERE rn > 1
ORDER BY "professionalId", "periodStart", "createdAt" DESC;

-- 2) Quando estiver confortável, descomente e rode:
-- WITH ranked AS (
--   SELECT
--     id,
--     ROW_NUMBER() OVER (
--       PARTITION BY "professionalId", "periodStart", "periodEnd"
--       ORDER BY "createdAt" DESC
--     ) AS rn
--   FROM commissions
--   WHERE status = 'PENDING'
-- )
-- DELETE FROM commissions
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
