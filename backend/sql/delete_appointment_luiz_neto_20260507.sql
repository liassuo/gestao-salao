-- Deleta agendamento f90a5465-4f69-46a8-8603-14bc10a60333 (Luiz Neto, 2026-05-07 09:30, julio cesar)
-- e tudo relacionado: order, order_items, payment (sai do caixa), debts, appointment_services.
--
-- COMO USAR:
--   1. Rode o bloco "VERIFICAR" e confirme que retorna o agendamento esperado.
--   2. Se OK, rode o bloco "DELETAR" (transacional).
--
-- COMISSAO:
--   Comissao e agregada por periodo+profissional. Nao apagar a linha inteira.
--   Use o BLOCO 3 abaixo para descontar os R$ 40 deste atendimento da comissao
--   do julio cesar (se a comissao do periodo ja tiver sido gerada).

-- ============================================================
-- BLOCO 1: VERIFICAR
-- ============================================================
SELECT
  a.id            AS appointment_id,
  a."scheduledAt",
  a.status,
  c.name          AS cliente,
  p.name          AS profissional,
  o.id            AS order_id,
  o.status        AS order_status,
  o."totalAmount",
  pay.id          AS payment_id,
  pay.method,
  pay.amount,
  pay."cashRegisterId"
FROM appointments a
JOIN clients c        ON c.id = a."clientId"
JOIN professionals p  ON p.id = a."professionalId"
LEFT JOIN orders o    ON o."appointmentId" = a.id
LEFT JOIN payments pay ON pay."appointmentId" = a.id
WHERE a.id = 'f90a5465-4f69-46a8-8603-14bc10a60333';

-- ============================================================
-- BLOCO 2: DELETAR
-- ============================================================
BEGIN;

-- 1. itens da comanda
DELETE FROM order_items
WHERE "orderId" IN (
  SELECT id FROM orders WHERE "appointmentId" = 'f90a5465-4f69-46a8-8603-14bc10a60333'
);

-- 2. comanda
DELETE FROM orders
WHERE "appointmentId" = 'f90a5465-4f69-46a8-8603-14bc10a60333';

-- 3. pagamento (sai do caixa)
DELETE FROM payments
WHERE "appointmentId" = 'f90a5465-4f69-46a8-8603-14bc10a60333';

-- 4. dividas vinculadas (se houver)
DELETE FROM debts
WHERE "appointmentId" = 'f90a5465-4f69-46a8-8603-14bc10a60333';

-- 5. servicos do agendamento (Cascade ja cobriria, mas deixo explicito)
DELETE FROM appointment_services
WHERE "appointmentId" = 'f90a5465-4f69-46a8-8603-14bc10a60333';

-- 6. agendamento
DELETE FROM appointments
WHERE id = 'f90a5465-4f69-46a8-8603-14bc10a60333'
RETURNING id;

-- Confira o RETURNING: deve retornar 1 linha. Se retornar 0, faca ROLLBACK.
COMMIT;
-- Em caso de erro: ROLLBACK;


-- ============================================================
-- BLOCO 3: AJUSTAR COMISSAO DO JULIO CESAR (se ja foi gerada)
-- ============================================================
-- O agendamento valia R$ 40,00 (4000 centavos), servico avulso (sem assinatura).
-- A contribuicao dele para a comissao foi: 4000 * commissionRate / 100.
--
-- 3.1 - Conferir se existe comissao gerada que cobre 2026-05-07 para julio cesar:

SELECT
  com.id,
  com."periodStart",
  com."periodEnd",
  com.status,
  com.amount,
  com."amountServices",
  com."amountSubscription",
  com."amountProducts",
  com."amountDeductedDebts",
  p.name           AS profissional,
  p."commissionRate",
  -- valor a descontar (em centavos)
  ROUND(4000 * p."commissionRate" / 100.0)::int AS desconto_centavos
FROM commissions com
JOIN professionals p ON p.id = com."professionalId"
WHERE p.name ILIKE 'julio cesar'
  AND com."periodStart" <= '2026-05-07 23:59:59'
  AND com."periodEnd"   >= '2026-05-07 00:00:00';

-- 3.2 - Se o SELECT acima retornou 1 linha com status PENDING, rode o UPDATE.
--       SUBSTITUA <COMMISSION_ID> pelo id retornado e <DESCONTO> pelo valor
--       da coluna desconto_centavos (ex: se commissionRate = 50, desconto = 2000).
--       Se status = PAID, NAO altere (a comissao ja foi paga ao profissional);
--       me avise pra decidirmos se gera ajuste/divida.

-- BEGIN;
-- UPDATE commissions
-- SET amount          = amount - <DESCONTO>,
--     "amountServices" = "amountServices" - <DESCONTO>,
--     "updatedAt"      = NOW()
-- WHERE id = '<COMMISSION_ID>'
--   AND status = 'PENDING'
-- RETURNING id, amount, "amountServices";
-- COMMIT;

