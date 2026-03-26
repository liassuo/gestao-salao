-- Origem do agendamento: ADMIN (painel) ou CLIENT (app do cliente)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ADMIN';

-- Indica se o agendamento usou crédito de assinatura
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "usedSubscriptionCut" BOOLEAN NOT NULL DEFAULT FALSE;
