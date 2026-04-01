-- Adiciona campo de fichas nos serviços (sistema de pote para comissão de assinaturas)
ALTER TABLE services ADD COLUMN IF NOT EXISTS "fichas" INTEGER NOT NULL DEFAULT 0;
