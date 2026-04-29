-- Registra quanto foi descontado de débitos do profissional na comissão.
-- A comissão líquida exibida ao profissional é:
--   amount - amountDeductedDebts
-- (e nunca fica negativa: se o débito superar a comissão, o resíduo
-- permanece em professional_debts como PENDING para deduzir no próximo ciclo)
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS "amountDeductedDebts" INTEGER NOT NULL DEFAULT 0;
