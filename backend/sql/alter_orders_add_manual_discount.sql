-- Desconto manual aplicado pelo operador no fechamento da comanda.
-- Valor em centavos, subtraido do totalAmount no momento da cobranca.
-- totalAmount continua sendo a soma dos itens (nao mexer); o liquido a cobrar
-- vira (totalAmount - manualDiscount), com clamp em zero no codigo.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "manualDiscount" INTEGER NOT NULL DEFAULT 0
    CHECK ("manualDiscount" >= 0);
