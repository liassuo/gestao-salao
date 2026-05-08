-- Garante no máximo UMA assinatura com status='ACTIVE' por cliente.
-- Sem essa restrição, é possível um cliente ter duas linhas ACTIVE
-- (race em /subscribe + webhook) ou uma ACTIVE + uma PENDING_PAYMENT,
-- e o frontend acabar mostrando a errada — gerando o bug "cliente
-- com plano sai como sem plano" no agendamento.
--
-- ATENÇÃO: rode primeiro o diagnóstico abaixo. Se houver duplicatas
-- ACTIVE para o mesmo cliente, este CREATE INDEX vai falhar e você
-- precisa cancelar manualmente as duplicadas antes.

-- 1. DIAGNÓSTICO — duplicatas ACTIVE existentes
-- SELECT "clientId", COUNT(*) AS active_count
-- FROM client_subscriptions
-- WHERE status = 'ACTIVE'
-- GROUP BY "clientId"
-- HAVING COUNT(*) > 1;

-- 2. Para resolver duplicatas, manter só a mais recente como ACTIVE:
-- UPDATE client_subscriptions
-- SET status = 'CANCELED', "updatedAt" = NOW()
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id,
--       ROW_NUMBER() OVER (PARTITION BY "clientId" ORDER BY "createdAt" DESC) AS rn
--     FROM client_subscriptions
--     WHERE status = 'ACTIVE'
--   ) t
--   WHERE rn > 1
-- );

-- 3. Aplicar o índice
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_subscriptions_one_active_per_client
  ON client_subscriptions ("clientId")
  WHERE status = 'ACTIVE';
