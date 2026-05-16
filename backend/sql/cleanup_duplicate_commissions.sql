-- ============================================================
-- Limpeza de comissões PENDING após fix de cálculo + idempotência
-- ============================================================
--
-- Comissões PAID NUNCA são tocadas em nenhuma das opções abaixo.
-- Escolha UMA das opções e descomente o bloco correspondente.
--
-- Contexto: comissões PENDING geradas antes do fix usavam
-- plan.price (valor inflado) em vez do faturamento real de
-- pagamentos. Além disso, gerações repetidas duplicaram registros.

-- ============================================================
-- OPÇÃO A (RECOMENDADA): apaga TODAS as PENDING e você regera
-- do zero a partir do D'Pote. Garante valores corretos.
-- ============================================================

-- Confira antes:
SELECT count(*) AS pending_a_apagar
FROM commissions WHERE status = 'PENDING';

-- Quando estiver confortável, descomente:
-- DELETE FROM commissions WHERE status = 'PENDING';


-- ============================================================
-- OPÇÃO B (conservadora): apaga só duplicatas exatas, mantendo
-- a mais recente por (profissional, periodStart, periodEnd).
-- Valores podem continuar inflados se foram gerados antes do fix.
-- ============================================================

-- Confira o que sairia:
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "professionalId", "periodStart", "periodEnd"
      ORDER BY "createdAt" DESC
    ) AS rn
  FROM commissions
  WHERE status = 'PENDING'
)
SELECT count(*) AS duplicatas_a_apagar FROM ranked WHERE rn > 1;

-- Quando estiver confortável, descomente:
-- WITH ranked AS (
--   SELECT id,
--     ROW_NUMBER() OVER (
--       PARTITION BY "professionalId", "periodStart", "periodEnd"
--       ORDER BY "createdAt" DESC
--     ) AS rn
--   FROM commissions
--   WHERE status = 'PENDING'
-- )
-- DELETE FROM commissions
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
