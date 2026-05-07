-- Adiciona coluna displayOrder em subscription_plans para permitir que o admin
-- defina a ordem em que os planos aparecem para o cliente na tela de planos.
-- Menor displayOrder aparece primeiro. Empates ou valores nulos caem no fallback (price asc).

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_display_order
  ON subscription_plans ("displayOrder", "price");
