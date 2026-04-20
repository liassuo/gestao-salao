-- Adiciona coluna discountPercent (0-100) em subscription_plans.
-- Aplicado em serviços e produtos quando o cliente tem assinatura ativa do plano.
-- Quando houver promoção ativa no item e desconto da assinatura, prevalece o MAIOR dos dois.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER NOT NULL DEFAULT 0
  CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100);
