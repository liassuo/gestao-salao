-- Adicionar coluna para armazenar o ID do customer no Asaas
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT;

-- Indice para busca rápida por asaasCustomerId
CREATE INDEX IF NOT EXISTS idx_clients_asaas_customer_id ON clients("asaasCustomerId");
