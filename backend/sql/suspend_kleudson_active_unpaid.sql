-- Suspende a assinatura ATIVA do Kleudson que ficou ACTIVE sem pagamento.
--
-- Contexto: o bug registeredBy (payments.registeredBy recebia clientId em vez do
-- id de um usuario ADMIN -> violava a FK -> insert do pagamento falhava em
-- silencio) fazia a confirmacao manual/reativacao ativar a assinatura sem gravar
-- nenhum payment. Kleudson (2o ciclo, vence 05/07) voltou ACTIVE sem ter pago.
-- O codigo ja foi corrigido (resolveSystemRegisteredBy); este script so conserta
-- o dado existente desse cliente.
--
-- ATENCAO: NAO usar a varredura ampla "todo ACTIVE sem payment.paidAt" -- por
-- causa do mesmo bug, muitos clientes que pagaram em DINHEIRO tambem ficaram sem
-- linha em payments. A varredura ampla suspenderia quem pagou. Por isso este
-- script e ALVO UNICO: Kleudson.
--
-- Efeito: status vira SUSPENDED -> no app dele aparece "Reativar assinatura"
-- (reactivateMySubscription busca status='SUSPENDED') e ele paga p/ continuar.
--
-- Idempotente: rodar de novo nao afeta nada (status ja != ACTIVE).

-- 1) DIAGNOSTICO -- rode primeiro e confirme que e o Kleudson certo (1 linha):
SELECT cs.id, cs."clientId", c.name AS cliente, c.phone, cs.status,
       cs."startDate", cs."endDate", cs."cutsUsedThisMonth"
FROM client_subscriptions cs
JOIN clients c ON c.id = cs."clientId"
WHERE cs.status = 'ACTIVE'
  AND c.name ILIKE '%Kleudson%'
  AND regexp_replace(c.phone, '\D', '', 'g') LIKE '%991271625%';

-- 2) APLICAR -- suspende exatamente o registro acima:
UPDATE client_subscriptions cs
SET status = 'SUSPENDED',
    "updatedAt" = now()
FROM clients c
WHERE c.id = cs."clientId"
  AND cs.status = 'ACTIVE'
  AND c.name ILIKE '%Kleudson%'
  AND regexp_replace(c.phone, '\D', '', 'g') LIKE '%991271625%';

-- 3) CONFERIR -- deve mostrar SUSPENDED:
SELECT cs.id, c.name, cs.status, cs."updatedAt"
FROM client_subscriptions cs
JOIN clients c ON c.id = cs."clientId"
WHERE c.name ILIKE '%Kleudson%'
  AND regexp_replace(c.phone, '\D', '', 'g') LIKE '%991271625%';
