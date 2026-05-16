-- Adiciona vinculo com a assinatura recorrente no Asaas.
-- Sem essa coluna, o codigo TS quebra ao tentar acessar
-- subscription.asaasSubscriptionId nas integracoes.
ALTER TABLE client_subscriptions
  ADD COLUMN IF NOT EXISTS "asaasSubscriptionId" TEXT;

CREATE INDEX IF NOT EXISTS idx_client_subs_asaas_id
  ON client_subscriptions ("asaasSubscriptionId")
  WHERE "asaasSubscriptionId" IS NOT NULL;
