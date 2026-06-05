-- Suspende assinaturas ACTIVE que nunca tiveram pagamento confirmado.
--
-- Contexto: ate o commit fbfe8ed (2026-06-05), quando o Asaas nao estava
-- configurado a assinatura nascia 'ACTIVE' direto, sem pagamento (initialStatus =
-- configured ? 'PENDING_PAYMENT' : 'ACTIVE'). Essas assinaturas ficaram ativas de
-- graca e parecem "renovadas automaticamente sem cobranca". O fix so corrigiu
-- dali pra frente; este script trata os dados ja existentes.
--
-- Acao: tudo que esta ACTIVE e nao tem nenhuma linha em payments com paidAt
-- preenchido vira SUSPENDED. O cliente passa a ver "Reativar assinatura" no app
-- (reactivateMySubscription busca status='SUSPENDED') e precisa pagar p/ continuar.
--
-- Idempotente: rodar de novo nao afeta nada (a 2a vez a lista ja esta vazia).

-- 1) DIAGNOSTICO — rode primeiro e confira a lista de afetados:
SELECT cs.id, cs."clientId", c.name AS cliente, cs.status,
       cs."startDate", cs."endDate"
FROM client_subscriptions cs
JOIN clients c ON c.id = cs."clientId"
WHERE cs.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p."subscriptionId" = cs.id AND p."paidAt" IS NOT NULL
  )
ORDER BY cs."startDate";

-- 2) APLICAR — suspende os mesmos registros acima:
UPDATE client_subscriptions cs
SET status = 'SUSPENDED',
    "updatedAt" = now()
WHERE cs.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p."subscriptionId" = cs.id AND p."paidAt" IS NOT NULL
  );
