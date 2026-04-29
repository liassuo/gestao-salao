-- Tabela de débitos do profissional com a barbearia.
-- Casos: comanda paga como débito (ex.: barbeiro consome um produto) ou
-- lançamento manual avulso (ex.: vale-adiantamento, multa, ferramenta perdida).
--
-- Liquidação padrão: dedução automática na próxima comissão.
-- Liquidação alternativa: pagamento em dinheiro (cai no caixa via payments).
--
-- IMPORTANTE: professionals.id, orders.id e commissions.id são TEXT no schema
-- atual (string cuid/uuid armazenada como text). Por isso as FKs também são TEXT.
CREATE TABLE IF NOT EXISTS professional_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "professionalId" TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,

  -- Comanda de origem (NULL para lançamento manual)
  "orderId" TEXT REFERENCES orders(id) ON DELETE SET NULL,

  -- Valores em centavos
  amount INTEGER NOT NULL CHECK (amount > 0),
  "amountPaid" INTEGER NOT NULL DEFAULT 0,
  "remainingBalance" INTEGER NOT NULL,

  description TEXT,

  -- PENDING = em aberto
  -- DEDUCTED = quitado por dedução em comissão
  -- SETTLED_CASH = quitado em dinheiro (gera payment)
  -- VOIDED = anulado (ex.: comanda de origem cancelada)
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'DEDUCTED', 'SETTLED_CASH', 'VOIDED')),

  -- Comissão na qual foi descontado (quando status = DEDUCTED)
  "deductedFromCommissionId" TEXT REFERENCES commissions(id) ON DELETE SET NULL,

  "settledAt" TIMESTAMP WITH TIME ZONE,

  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_professional_debts_professional
  ON professional_debts("professionalId");
CREATE INDEX IF NOT EXISTS idx_professional_debts_status
  ON professional_debts(status);
CREATE INDEX IF NOT EXISTS idx_professional_debts_order
  ON professional_debts("orderId");
CREATE INDEX IF NOT EXISTS idx_professional_debts_pending_by_prof
  ON professional_debts("professionalId", status) WHERE status = 'PENDING';
