-- Adiciona campo de fichas nos serviços (sistema de pote para comissão de assinaturas)
-- Se fichas = 0, o sistema usa o duration (minutos) como fallback
ALTER TABLE services ADD COLUMN IF NOT EXISTS "fichas" INTEGER NOT NULL DEFAULT 0;
