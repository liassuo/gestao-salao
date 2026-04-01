-- Adiciona coluna para PIN de acesso à página de comissões
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "commissionPin" TEXT;
