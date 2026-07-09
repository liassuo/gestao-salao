-- payments.paidAt: NOT NULL -> NULLABLE.
--
-- Por quê: dois fluxos do código registram payments SEM data de pagamento, por design:
--   1. Webhook PAYMENT_OVERDUE (asaas-webhook.controller.ts): recria o payment local de
--      uma cobrança recorrente VENCIDA (não paga) para suspender e lançar a dívida.
--   2. Marcador de cartão recusado do débito automático (subscriptions.service.ts,
--      autoChargeTokenizedRenewalsCron): linha com asaasStatus=DECLINED e paidAt=null
--      que garante a idempotência (não recobrar a mesma virada).
-- Com a coluna NOT NULL esses inserts SEMPRE falharam (visto em produção 09/07/2026:
-- "null value in column paidAt ... violates not-null constraint").
--
-- Seguro para as leituras: caixa/dashboard/relatórios filtram por businessDate/paidAt
-- (linha com ambos nulos fica fora de qualquer janela) e isCurrentCyclePaid consulta
-- apenas paidAt not-null. paidAt nulo significa "cobrança registrada, não paga".
--
-- Aplicar no SQL Editor do Supabase:

ALTER TABLE payments ALTER COLUMN "paidAt" DROP NOT NULL;

COMMENT ON COLUMN payments."paidAt" IS
  'Data real do pagamento (local YYYY-MM-DDTHH:MM:SS). NULL = cobrança registrada mas não paga (ex.: recorrência vencida espelhada pelo webhook OVERDUE, marcador de cartão recusado do débito automático).';
