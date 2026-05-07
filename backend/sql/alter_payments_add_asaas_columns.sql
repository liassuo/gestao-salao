-- Adiciona colunas Asaas faltantes na tabela payments.
-- Bug crítico: o código (cash-register, asaas-webhook, orders, appointments)
-- referencia essas colunas, mas a migration nunca havia sido aplicada.
-- Sem elas, calculateDailyTotals falha silenciosamente e o caixa fecha com R$ 0.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "asaasPaymentId" text,
  ADD COLUMN IF NOT EXISTS "asaasStatus"    text,
  ADD COLUMN IF NOT EXISTS "billingType"    text,
  ADD COLUMN IF NOT EXISTS "invoiceUrl"     text,
  ADD COLUMN IF NOT EXISTS "bankSlipUrl"    text;

CREATE INDEX IF NOT EXISTS idx_payments_asaas_payment_id
  ON payments ("asaasPaymentId")
  WHERE "asaasPaymentId" IS NOT NULL;
