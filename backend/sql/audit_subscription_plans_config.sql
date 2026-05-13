-- Auditoria da configuracao dos planos de assinatura.
-- Objetivo: ver, plano por plano, quais servicos estao marcados com 100%
-- ("gratis no plano") e quais nao estao.
--
-- Use o resultado pra editar cada plano no painel e marcar como 100% os
-- servicos que devem ser GRATIS pra quem tem aquele plano.

-- ============================================================
-- BLOCO A: Lista todos os planos + servicos com desconto especifico
-- ============================================================
SELECT
  sp.id                AS plan_id,
  sp.name              AS plano,
  sp."cutsPerMonth"    AS cortes_mes,
  sp."discountPercent" AS desconto_geral,
  s.name               AS servico,
  sps."discountPercent" AS desconto_servico,
  CASE WHEN sps."discountPercent" = 100 THEN '<-- GRATIS' ELSE '' END AS observacao
FROM subscription_plans sp
LEFT JOIN subscription_plan_services sps ON sps."planId" = sp.id
LEFT JOIN services s ON s.id = sps."serviceId"
ORDER BY sp.name, s.name;

-- ============================================================
-- BLOCO B: Quem (cliente) ta em qual plano? — pros clientes da
--          auditoria do bug, te mostra qual plano deles precisa ser editado
-- ============================================================
SELECT
  c.name                          AS cliente,
  sp.id                           AS plan_id,
  sp.name                         AS plano,
  sp."discountPercent"            AS desconto_geral,
  -- servicos do plano que ja estao a 100%
  (
    SELECT string_agg(s2.name, ', ')
    FROM subscription_plan_services sps2
    JOIN services s2 ON s2.id = sps2."serviceId"
    WHERE sps2."planId" = sp.id AND sps2."discountPercent" = 100
  ) AS servicos_gratis_configurados
FROM client_subscriptions cs
JOIN clients c            ON c.id = cs."clientId"
JOIN subscription_plans sp ON sp.id = cs."planId"
WHERE cs.status = 'ACTIVE'
  AND cs."clientId" IN (
    SELECT a."clientId"
    FROM appointments a
    JOIN orders o ON o."appointmentId" = a.id
    WHERE a."usedSubscriptionCut" = true
      AND o.status = 'PENDING'
      AND a."totalPrice" = 0
  )
ORDER BY plano, c.name;
