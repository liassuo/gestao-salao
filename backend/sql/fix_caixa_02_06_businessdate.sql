-- =============================================================================
-- ACERTO PONTUAL: caixa de 02/06/2026 (corte do Metiloco que era de 01/06)
-- =============================================================================
-- Contexto: o corte do cliente "Metiloco" foi ATENDIDO em 01/06 15:45 mas PAGO às
-- 00:14 de 02/06, então caiu no caixa de 02/06 (R$520). Deveria contar no caixa de
-- 01/06. Este script preenche o businessDate dos pagamentos e recalcula os dois caixas.
--
-- Rodar DEPOIS de alter_payments_add_business_date.sql (que cria a coluna).
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
--
-- IMPORTANTE: confira os números no final (bloco de verificação) antes de confiar.
-- =============================================================================

-- 1) Preenche businessDate de TODOS os pagamentos vinculados a um agendamento
--    pela data do atendimento (scheduledAt, à meia-noite local). Sem agendamento,
--    usa o próprio paidAt. Limitado aos pagamentos de 01/06 e 02/06 para não tocar
--    no histórico mais antigo (você pediu para mexer só nesses dias).
UPDATE payments p
SET "businessDate" = to_char(
      date_trunc('day', a."scheduledAt"::timestamp), 'YYYY-MM-DD'
    ) || 'T00:00:00'
FROM orders o
JOIN appointments a ON a.id = o."appointmentId"
WHERE o."paymentId" = p.id
  AND a."scheduledAt" IS NOT NULL
  AND p."paidAt" >= '2026-06-01T00:00:00'
  AND p."paidAt" <= '2026-06-02T23:59:59';

-- 1b) Pagamentos desses dias SEM agendamento → businessDate = dia do paidAt.
UPDATE payments p
SET "businessDate" = substring(p."paidAt" FROM 1 FOR 10) || 'T00:00:00'
WHERE p."businessDate" IS NULL
  AND p."paidAt" >= '2026-06-01T00:00:00'
  AND p."paidAt" <= '2026-06-02T23:59:59';

-- 2) Revincula cashRegisterId pelo dia contábil (businessDate) para os caixas
--    de 01/06 e 02/06. Assim o corte do Metiloco passa a apontar para o caixa de 01.
UPDATE payments p
SET "cashRegisterId" = cr.id
FROM cash_registers cr
WHERE cr.date >= '2026-06-01T00:00:00' AND cr.date <= '2026-06-02T23:59:59'
  AND substring(p."businessDate" FROM 1 FOR 10) = substring(cr.date FROM 1 FOR 10)
  AND p."businessDate" >= '2026-06-01T00:00:00'
  AND p."businessDate" <= '2026-06-02T23:59:59';

-- 3) Recalcula os totais dos caixas de 01/06 e 02/06 a partir do businessDate.
--    (CASH/PIX/CARD + total; ignora estornados/cancelados/deletados do Asaas.)
WITH dia AS (
  SELECT
    cr.id AS register_id,
    substring(cr.date FROM 1 FOR 10) AS dstr,
    cr."openingBalance" AS opening,
    cr."closingBalance" AS closing,
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'CASH'), 0) AS cash,
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'PIX'),  0) AS pix,
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'CARD'), 0) AS card,
    COALESCE(SUM(p.amount), 0) AS total
  FROM cash_registers cr
  LEFT JOIN payments p
    ON substring(COALESCE(p."businessDate", p."paidAt") FROM 1 FOR 10)
         = substring(cr.date FROM 1 FOR 10)
   AND (p."asaasStatus" IS NULL
        OR p."asaasStatus" NOT IN ('REFUNDED','DELETED','CANCELED'))
  WHERE cr.date >= '2026-06-01T00:00:00' AND cr.date <= '2026-06-02T23:59:59'
  GROUP BY cr.id, cr.date, cr."openingBalance", cr."closingBalance"
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
-- 4) VERIFICAÇÃO — confira antes de confiar (não altera nada)
-- =============================================================================
-- Esperado depois do acerto:
--   01/06 → totalRevenue R$120,00 (Hugo 40 + Dayane 40 + Metiloco 40)
--   02/06 → totalRevenue R$480,00 (520 - 40 do Metiloco)
SELECT
  substring(cr.date FROM 1 FOR 10)        AS dia_caixa,
  cr."isOpen"                             AS aberto,
  cr."totalRevenue" / 100.0               AS receita,
  cr."totalCard" / 100.0                  AS cartao,
  cr.discrepancy / 100.0                  AS discrepancia,
  (SELECT count(*) FROM payments p
     WHERE substring(COALESCE(p."businessDate", p."paidAt") FROM 1 FOR 10)
             = substring(cr.date FROM 1 FOR 10)) AS qtd_pagamentos_do_dia
FROM cash_registers cr
WHERE cr.date >= '2026-06-01T00:00:00' AND cr.date <= '2026-06-02T23:59:59'
ORDER BY cr.date;
