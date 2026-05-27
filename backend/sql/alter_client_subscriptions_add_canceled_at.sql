-- Cancelamento "lazy": cliente cancela mas mantem beneficios ate o vencimento.
-- canceledAt marca o momento do cancelamento; status fica ACTIVE ate endDate passar.
-- Cron varre ACTIVE+canceledAt+endDate<now e flipa para CANCELED.
-- Quando NULL (default): assinatura nao tem cancelamento pendente.
ALTER TABLE client_subscriptions
  ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_canceled_at
  ON client_subscriptions("canceledAt")
  WHERE "canceledAt" IS NOT NULL;
