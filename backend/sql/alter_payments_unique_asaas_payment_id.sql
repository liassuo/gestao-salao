-- Torna payments."asaasPaymentId" ÚNICO (índice parcial: ignora NULL de
-- pagamentos manuais/dinheiro, que não têm cobrança Asaas).
--
-- Motivo: na assinatura recorrente por CARTÃO a 1ª cobrança confirma na hora e o
-- webhook pode correr com o insert síncrono do pagamento. O índice atual
-- (idx_payments_asaas_payment_id) NÃO é único → dava pra gravar 2 payments para a
-- mesma cobrança e contar em dobro no caixa. Com índice único, o 2º insert falha
-- (e o guard de idempotência no código já evita o caminho normal).
--
-- IMPORTANTE: se já existirem duplicados, o passo 3 (CREATE UNIQUE) falha. Rode o
-- passo 1, resolva com o passo 2 se preciso, e só então o passo 3.

-- 1) Diagnóstico: cobranças Asaas com mais de um payment local
SELECT "asaasPaymentId", count(*) AS qtd, array_agg(id) AS payment_ids
FROM payments
WHERE "asaasPaymentId" IS NOT NULL
GROUP BY "asaasPaymentId"
HAVING count(*) > 1
ORDER BY qtd DESC;

-- 2) (SÓ se o passo 1 retornar linhas) Remove os redundantes, mantendo 1 por
--    cobrança: prioriza o que tem paidAt; em empate, o mais antigo (createdAt).
--    Descomente para aplicar.
-- DELETE FROM payments p
-- USING (
--   SELECT id,
--          row_number() OVER (
--            PARTITION BY "asaasPaymentId"
--            ORDER BY ("paidAt" IS NOT NULL) DESC, "createdAt" ASC
--          ) AS rn
--   FROM payments
--   WHERE "asaasPaymentId" IS NOT NULL
-- ) d
-- WHERE p.id = d.id AND d.rn > 1;

-- 3) Substitui o índice não-único pelo único parcial
DROP INDEX IF EXISTS idx_payments_asaas_payment_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_asaas_payment_id
  ON payments ("asaasPaymentId")
  WHERE "asaasPaymentId" IS NOT NULL;
