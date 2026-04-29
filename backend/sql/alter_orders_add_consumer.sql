-- Permite que uma comanda represente consumo de um profissional (não de cliente).
-- Quando consumerType = 'PROFESSIONAL', a comanda não é paga em dinheiro:
-- ela é lançada como débito do profissional (ver tabela professional_debts) e
-- não gera registro em payments nem comissão sobre os itens dela.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "consumerType" TEXT NOT NULL DEFAULT 'CLIENT'
    CHECK ("consumerType" IN ('CLIENT', 'PROFESSIONAL'));

-- professionals.id é TEXT no schema atual, então a FK precisa ser TEXT.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "consumerProfessionalId" TEXT
    REFERENCES professionals(id) ON DELETE SET NULL;

-- Status especial para comanda lançada como débito do profissional.
-- Não há ENUM nas tabelas (status é TEXT), então só documentamos aqui:
--   'PENDING'        — comanda aberta
--   'PAID'           — paga em dinheiro/Asaas (caixa)
--   'PAID_AS_DEBT'   — virou débito do profissional (não entra no caixa)
--   'CANCELED'       — cancelada (reverte estoque/débito quando aplicável)

CREATE INDEX IF NOT EXISTS idx_orders_consumer_professional
  ON orders("consumerProfessionalId") WHERE "consumerProfessionalId" IS NOT NULL;
