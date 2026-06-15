-- Controle de notificações já enviadas, para NÃO floodar o cliente (o Asaas foi
-- desligado por mandar demais; o aviso próprio manda só o necessário e usa esta
-- tabela pra não repetir o mesmo aviso).
-- `dedupeKey` é único: ex "sub-expiry:<subId>:<cycleEnd>:3d" ou ":0d".
CREATE TABLE IF NOT EXISTS notification_log (
  id TEXT PRIMARY KEY,
  "dedupeKey" TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,            -- ex: 'SUB_EXPIRY', 'APPOINTMENT_REMINDER'
  "clientId" TEXT,
  channel TEXT,                  -- ex: 'EMAIL', 'PUSH'
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_dedupe ON notification_log("dedupeKey");
CREATE INDEX IF NOT EXISTS idx_notification_log_client ON notification_log("clientId");
