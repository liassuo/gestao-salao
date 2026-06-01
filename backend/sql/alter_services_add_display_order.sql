-- Adiciona coluna displayOrder em services para permitir que o admin
-- defina a ordem em que os servicos aparecem para o cliente na tela de servicos.
-- Menor displayOrder aparece primeiro. Empates ou valores nulos caem no fallback (price asc).

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_services_display_order
  ON services ("displayOrder", "price");
