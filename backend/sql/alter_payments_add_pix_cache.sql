-- Adicionar colunas para cache do QR Code PIX nos pagamentos
-- Evita chamadas repetidas ao Asaas para o mesmo QR Code
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "pixQrCodeBase64" text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "pixCopyPaste" text;
