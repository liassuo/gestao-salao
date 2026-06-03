-- =============================================================================
-- ACERTO PONTUAL: caixa de 02/06/2026 (corte do Metiloco que era de 01/06)
-- =============================================================================
-- Contexto: o corte do cliente "Metiloco" foi ATENDIDO em 01/06 15:45 mas PAGO às
-- 00:14 de 02/06, então caiu no caixa de 02/06 (R$520). Deveria contar no caixa de
-- 01/06. Este script preenche o businessDate dos pagamentos e recalcula os dois caixas.
--
-- JÁ FOI APLICADO em produção em 2026-06-03 (via psql). Mantido idempotente para
-- registro/reaplicação.
--
-- TIPOS REAIS no banco (importante p/ os casts abaixo):
--   payments.paidAt      = timestamp        -> use to_char(...,'YYYY-MM-DD')
--   appointments.scheduledAt = timestamp    -> idem
--   cash_registers.date  = date             -> to_char(...,'YYYY-MM-DD') ou ::text
--   payments.businessDate = text (canônico "YYYY-MM-DDT00:00:00")
-- NÃO usar substring() direto sobre timestamp/date: erro 42883.
--
-- Rodar DEPOIS de alter_payments_add_business_date.sql (cria a coluna businessDate).
-- =============================================================================

-- 1) businessDate dos pagamentos COM agendamento = dia do atendimento (scheduledAt).
UPDATE payments p
SET "businessDate" = to_char(a."scheduledAt", 'YYYY-MM-DD') || 'T00:00:00'
FROM orders o
JOIN appointments a ON a.id = o."appointmentId"
WHERE o."paymentId" = p.id
  AND a."scheduledAt" IS NOT NULL
  AND p."paidAt" >= '2026-06-01T00:00:00'
  AND p."paidAt" <= '2026-06-02T23:59:59';

-- 1b) Pagamentos desses dias SEM agendamento → businessDate = dia do paidAt.
UPDATE payments p
SET "businessDate" = to_char(p."paidAt", 'YYYY-MM-DD') || 'T00:00:00'
WHERE p."businessDate" IS NULL
  AND p."paidAt" >= '2026-06-01T00:00:00'
  AND p."paidAt" <= '2026-06-02T23:59:59';

-- 2) Revincula cashRegisterId pelo dia contábil (businessDate) para 01/06 e 02/06.
UPDATE payments p
SET "cashRegisterId" = cr.id
FROM cash_registers cr
WHERE cr.date >= '2026-06-01' AND cr.date <= '2026-06-02'
  AND left(p."businessDate", 10) = to_char(cr.date, 'YYYY-MM-DD')
  AND p."businessDate" >= '2026-06-01T00:00:00'
  AND p."businessDate" <= '2026-06-02T23:59:59';

-- 3) Recalcula os totais dos caixas de 01/06 e 02/06 a partir do dia contábil
--    (coalesce(businessDate, paidAt)). Ignora estornados/cancelados/deletados.
WITH dia AS (
  SELECT
    cr.id AS register_id,
    cr."openingBalance" AS opening,
    cr."closingBalance" AS closing,
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'CASH'), 0) AS cash,
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'PIX'),  0) AS pix,
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'CARD'), 0) AS card,
    COALESCE(SUM(p.amount), 0) AS total
  FROM cash_registers cr
  LEFT JOIN payments p
    ON COALESCE(left(p."businessDate", 10), to_char(p."paidAt", 'YYYY-MM-DD'))
         = to_char(cr.date, 'YYYY-MM-DD')
   AND (p."asaasStatus" IS NULL
        OR p."asaasStatus" NOT IN ('REFUNDED','DELETED','CANCELED'))
  WHERE cr.date >= '2026-06-01' AND cr.date <= '2026-06-02'
  GROUP BY cr.id, cr."openingBalance", cr."closingBalance"
)
UPDATE cash_registers cr
SET "totalCash"    = dia.cash,
    "totalPix"     = dia.pix,
    "totalCard"    = dia.card,
    "totalRevenue" = dia.total,
    "discrepancy"  = COALESCE(dia.closing, 0) - (COALESCE(dia.opening, 0) + dia.cash)
FROM dia
WHERE cr.id = dia.register_id;

-- =============================================================================
-- 4) VERIFICAÇÃO (só leitura). Esperado: 01/06 = R$120,00 ; 02/06 = R$480,00.
-- =============================================================================
SELECT
  to_char(cr.date, 'YYYY-MM-DD')          AS dia_caixa,
  cr."isOpen"                             AS aberto,
  cr."totalRevenue" / 100.0               AS receita,
  cr."totalCard" / 100.0                  AS cartao,
  cr.discrepancy / 100.0                  AS discrepancia,
  (SELECT count(*) FROM payments p
     WHERE COALESCE(left(p."businessDate", 10), to_char(p."paidAt", 'YYYY-MM-DD'))
             = to_char(cr.date, 'YYYY-MM-DD')) AS qtd_pagamentos_do_dia
FROM cash_registers cr
WHERE cr.date >= '2026-06-01' AND cr.date <= '2026-06-02'
ORDER BY cr.date;
