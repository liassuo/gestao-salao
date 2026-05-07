-- Deleta agendamento f90a5465-4f69-46a8-8603-14bc10a60333 (Luiz Neto, 2026-05-07 09:30, julio cesar)
-- e tudo relacionado: order, order_items, payment (sai do caixa), debts, appointment_services.
--
-- COMO USAR:
--   1. Rode o bloco "VERIFICAR" e confirme que retorna o agendamento esperado.
--   2. Se OK, rode o bloco "DELETAR" (transacional).
--
-- O QUE NAO E DELETADO:
--   commissions e agregada por periodo+profissional. Apagar distorce o historico.
--   Se precisar, recalcule a comissao do julio cesar para 2026-05 depois.

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
