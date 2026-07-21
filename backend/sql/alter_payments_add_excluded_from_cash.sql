-- Marca local de exclusão da receita para pagamento REAL que não deve contar
-- no caixa: agendamento pré-pago (PIX/cartão pelo app) que foi CANCELADO ou
-- virou NO-SHOW. O dinheiro entrou (não dá para apagar o payment — quebraria a
-- conciliação com o Asaas) e não foi estornado (não dá para usar asaasStatus:
-- é espelho do gateway e a reconciliação sobrescreveria), então a exclusão é
-- uma coluna própria, respeitada por isRevenuePayment (fonte única da receita:
-- caixa, dashboard, relatórios e comissões).
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "excludedFromCashAt" TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN payments."excludedFromCashAt" IS
  'Quando setado, o pagamento (real, não estornado) fica FORA da receita — ex.: pré-pago de agendamento cancelado/no-show. Motivo registrado em notes.';
