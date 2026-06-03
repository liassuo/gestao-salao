-- Adiciona a "data contábil" do pagamento (businessDate) na tabela payments.
--
-- Por quê: o caixa/dashboard/relatórios contabilizavam pela data do PAGAMENTO
-- (paidAt). Um atendimento de 01/06 pago às 00:14 de 02/06 caía no caixa de 02/06.
-- A regra correta é: a venda pertence ao DIA DO ATENDIMENTO. Quando há agendamento,
-- businessDate = data do appointment.scheduledAt; quando não há (balcão/avulso/
-- assinatura), businessDate = data do paidAt (fallback).
--
-- A coluna é preenchida pelo código no momento de criar/confirmar o pagamento.
-- Formato: string local "YYYY-MM-DDTHH:MM:SS" (mesmo padrão de paidAt e
-- cash_registers.date), para casar com as janelas de filtro do caixa.
--
-- NÃO faz backfill do histórico: pagamentos antigos ficam com businessDate NULL e
-- as leituras usam coalesce(businessDate, paidAt) — ou seja, histórico continua
-- contando pela data de pagamento, como antes. Só vendas novas adotam a regra nova.

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "businessDate" TEXT;

COMMENT ON COLUMN "payments"."businessDate" IS
  'Data contábil do pagamento (YYYY-MM-DDTHH:MM:SS local). Dia do atendimento (scheduledAt) quando há agendamento; senão dia do pagamento (paidAt). Usada pelo caixa/dashboard/relatórios. NULL = pagamento legado (usa paidAt via coalesce).';

CREATE INDEX IF NOT EXISTS idx_payments_business_date
  ON "payments" ("businessDate")
  WHERE "businessDate" IS NOT NULL;
