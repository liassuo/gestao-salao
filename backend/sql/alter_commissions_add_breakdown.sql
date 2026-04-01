-- Adiciona breakdown de comissões por fonte (serviços avulsos, assinatura, produtos)
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS "amountServices" INTEGER DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS "amountSubscription" INTEGER DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS "amountProducts" INTEGER DEFAULT 0;
