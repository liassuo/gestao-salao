-- Repara agendamentos atingidos pelo bug em que `useSubscriptionCut=true`
-- (cliente marcou "usar corte" pelo app) zerava TODOS os serviços, inclusive
-- extras fora do plano (ex.: sobrancelha avulsa). Pos-fix, extras precisam
-- ser cobrados normalmente com o desconto global do plano.
--
-- ESTRATEGIA:
--   * Usa a assinatura ATIVA atual do cliente para deduzir o que e plano vs extra.
--     Se o cliente nao tem mais assinatura ativa, o caso fica de fora (precisa
--     analise manual).
--   * Recalcula `order_items.unitPrice` so para itens-servico que NAO sao plano-incluso.
--     Item plano-incluso (override 100%) permanece R$ 0,00.
--   * Recalcula `orders.totalAmount` e `appointments.totalPrice` somando os itens.
--   * NAO mexe em pagamentos. Se o agendamento ja foi "pago" no caixa com 0,
--     o reajuste vai gerar saldo a receber — confira BLOCO 2 antes de aplicar.
--
-- COMO USAR:
--   1. Rode BLOCO 1 (somente SELECT) para auditar os casos.
--   2. Rode BLOCO 2 para ver o impacto financeiro (apt ja pago x nao pago).
--   3. Se OK, rode BLOCO 3 (UPDATE transacional).

-- ============================================================
-- BLOCO 1: AUDITORIA — quais agendamentos foram atingidos?
-- ============================================================
-- Lista agendamentos com `usedSubscriptionCut=true` cujo cliente tem assinatura
-- ATIVA agora e que contem ao menos 1 servico FORA do plano com unitPrice=0.

WITH active_sub AS (
  SELECT
    cs."clientId",
    cs.id              AS subscription_id,
    sp.id              AS plan_id,
    sp."discountPercent" AS global_percent
  FROM client_subscriptions cs
  JOIN subscription_plans sp ON sp.id = cs."planId"
  WHERE cs.status = 'ACTIVE'
),
plan_services AS (
  SELECT
    sps."planId",
    sps."serviceId",
    sps."discountPercent"
  FROM subscription_plan_services sps
)
SELECT
  a.id                            AS appointment_id,
  a."scheduledAt",
  a."totalPrice"                  AS current_total_price,
  a."isPaid",
  c.name                          AS cliente,
  o.id                            AS order_id,
  o."totalAmount"                 AS current_order_total,
  o.status                        AS order_status,
  oi.id                           AS order_item_id,
  oi."serviceId",
  s.name                          AS servico,
  s.price                         AS preco_tabela,
  oi."unitPrice"                  AS unit_price_atual,
  -- E plano-incluso?
  CASE WHEN ps."discountPercent" = 100 THEN 'PLANO' ELSE 'EXTRA' END AS tipo,
  asub.global_percent             AS desconto_global_plano,
  -- Preco corrigido: extras pegam desconto global; plano-incluso continua 0
  CASE
    WHEN ps."discountPercent" = 100 THEN 0
    ELSE ROUND(s.price * (100 - COALESCE(asub.global_percent, 0)) / 100.0)::int
  END                             AS unit_price_corrigido
FROM appointments a
JOIN clients c            ON c.id = a."clientId"
JOIN active_sub asub      ON asub."clientId" = a."clientId"
JOIN orders o             ON o."appointmentId" = a.id
JOIN order_items oi       ON oi."orderId" = o.id AND oi."itemType" = 'SERVICE'
JOIN services s           ON s.id = oi."serviceId"
LEFT JOIN plan_services ps ON ps."planId" = asub.plan_id AND ps."serviceId" = oi."serviceId"
WHERE a."usedSubscriptionCut" = true
  AND o.status = 'PENDING'         -- nao mexer em comandas ja fechadas
  -- so casos onde existe ao menos 1 extra zerado (caracteristico do bug)
  AND EXISTS (
    SELECT 1
    FROM order_items oi2
    LEFT JOIN plan_services ps2 ON ps2."planId" = asub.plan_id AND ps2."serviceId" = oi2."serviceId"
    WHERE oi2."orderId" = o.id
      AND oi2."itemType" = 'SERVICE'
      AND oi2."unitPrice" = 0
      AND (ps2."discountPercent" IS NULL OR ps2."discountPercent" <> 100)
  )
ORDER BY a."scheduledAt" DESC, a.id, oi.id;

-- ============================================================
-- BLOCO 2: IMPACTO FINANCEIRO — agrupado por agendamento
-- ============================================================
-- Mostra quanto o `totalPrice` mudaria. Atencao para `isPaid=true`: agendamento
-- ja consta como pago, vai virar saldo a cobrar do cliente.

WITH active_sub AS (
  SELECT cs."clientId", sp.id AS plan_id, sp."discountPercent" AS global_percent
  FROM client_subscriptions cs
  JOIN subscription_plans sp ON sp.id = cs."planId"
  WHERE cs.status = 'ACTIVE'
),
plan_services AS (
  SELECT sps."planId", sps."serviceId", sps."discountPercent"
  FROM subscription_plan_services sps
),
item_calc AS (
  SELECT
    a.id AS appointment_id,
    a."isPaid",
    a."totalPrice" AS current_total,
    SUM(
      CASE
        WHEN ps."discountPercent" = 100 THEN 0
        ELSE ROUND(s.price * (100 - COALESCE(asub.global_percent, 0)) / 100.0)::int
      END
    ) AS new_total
  FROM appointments a
  JOIN active_sub asub      ON asub."clientId" = a."clientId"
  JOIN orders o             ON o."appointmentId" = a.id AND o.status = 'PENDING'
  JOIN order_items oi       ON oi."orderId" = o.id AND oi."itemType" = 'SERVICE'
  JOIN services s           ON s.id = oi."serviceId"
  LEFT JOIN plan_services ps ON ps."planId" = asub.plan_id AND ps."serviceId" = oi."serviceId"
  WHERE a."usedSubscriptionCut" = true
  GROUP BY a.id, a."isPaid", a."totalPrice"
)
SELECT
  appointment_id,
  "isPaid"          AS pago_no_sistema,
  current_total     AS total_atual_centavos,
  new_total         AS total_corrigido_centavos,
  (new_total - current_total) AS diferenca_centavos
FROM item_calc
WHERE new_total <> current_total
ORDER BY (new_total - current_total) DESC;

-- ============================================================
-- BLOCO 3: APLICAR CORRECAO — UPDATE transacional
-- ============================================================
-- ATENCAO: Releia o resultado do BLOCO 2 antes de rodar.
-- Apos rodar, agendamentos com isPaid=true e diferenca>0 ficarao com totalPrice
-- maior que o pagamento registrado — pode exigir cobrar a diferenca manualmente
-- (ou criar uma debt). Esse SQL NAO faz isso, apenas corrige os valores.

BEGIN;

WITH active_sub AS (
  SELECT cs."clientId", sp.id AS plan_id, sp."discountPercent" AS global_percent
  FROM client_subscriptions cs
  JOIN subscription_plans sp ON sp.id = cs."planId"
  WHERE cs.status = 'ACTIVE'
),
plan_services AS (
  SELECT sps."planId", sps."serviceId", sps."discountPercent"
  FROM subscription_plan_services sps
),
target_items AS (
  SELECT
    oi.id AS order_item_id,
    CASE
      WHEN ps."discountPercent" = 100 THEN 0
      ELSE ROUND(s.price * (100 - COALESCE(asub.global_percent, 0)) / 100.0)::int
    END AS new_unit_price
  FROM appointments a
  JOIN active_sub asub      ON asub."clientId" = a."clientId"
  JOIN orders o             ON o."appointmentId" = a.id AND o.status = 'PENDING'
  JOIN order_items oi       ON oi."orderId" = o.id AND oi."itemType" = 'SERVICE'
  JOIN services s           ON s.id = oi."serviceId"
  LEFT JOIN plan_services ps ON ps."planId" = asub.plan_id AND ps."serviceId" = oi."serviceId"
  WHERE a."usedSubscriptionCut" = true
)
UPDATE order_items oi
SET "unitPrice" = ti.new_unit_price
FROM target_items ti
WHERE oi.id = ti.order_item_id
  AND oi."unitPrice" <> ti.new_unit_price;

-- Recalcula orders.totalAmount com base nos novos unitPrice
UPDATE orders o
SET "totalAmount" = sub.novo_total,
    "updatedAt"   = NOW()
FROM (
  SELECT o2.id AS order_id,
         COALESCE(SUM(oi."unitPrice" * oi.quantity), 0)::int AS novo_total
  FROM orders o2
  JOIN appointments a ON a.id = o2."appointmentId"
  LEFT JOIN order_items oi ON oi."orderId" = o2.id
  WHERE a."usedSubscriptionCut" = true
    AND o2.status = 'PENDING'
  GROUP BY o2.id
) sub
WHERE o.id = sub.order_id
  AND o."totalAmount" <> sub.novo_total;

-- Recalcula appointments.totalPrice pra refletir o novo total da comanda
UPDATE appointments a
SET "totalPrice" = o."totalAmount",
    "updatedAt"  = NOW()
FROM orders o
WHERE o."appointmentId" = a.id
  AND o.status = 'PENDING'
  AND a."usedSubscriptionCut" = true
  AND a."totalPrice" <> o."totalAmount"
RETURNING a.id, a."totalPrice";

-- Confira o RETURNING acima e os totais. Se algo parecer errado: ROLLBACK;
COMMIT;
