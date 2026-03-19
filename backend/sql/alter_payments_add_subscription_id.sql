-- Script para adicionar vínculo de assinatura na tabela de pagamentos
-- Habilita o reset de cortes automático quando uma cobrança avulsa de assinatura é paga

ALTER TABLE "payments" 
ADD COLUMN IF NOT EXISTS "subscriptionId" UUID REFERENCES "client_subscriptions"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "payments"."subscriptionId" IS 'ID da assinatura vinculada a este pagamento (para renovações manuais)';
