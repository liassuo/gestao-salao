-- payments: CHECK garantindo que businessDate só existe em pagamento PAGO.
--
-- Por quê: businessDate (dia contábil) é o que coloca um pagamento na janela do
-- caixa/dashboard/relatórios. Uma linha com businessDate preenchido e paidAt NULL
-- é cobrança NÃO paga contando como receita — foi o bug do incidente do caixa de
-- 13-14/07/2026 (webhook PAYMENT_OVERDUE gravava businessDate=hoje no espelho da
-- cobrança vencida, inflando o caixa e derrubando a tela de atendimentos do dia).
-- O código foi corrigido (espelho fica com ambos nulos; leitores exigem paidAt),
-- mas há ~16 pontos que inserem em payments: este CHECK faz o banco rejeitar a
-- escrita errada na hora, em vez de deixar a corrupção passar despercebida.
--
-- ORDEM DE APLICAÇÃO:
--   1. Rodar antes: node scripts/fix-caixa-overdue-businessdate-2026-07-14.mjs --apply
--      (zera o businessDate das linhas não pagas existentes — sem isso o ALTER falha
--      na validação das linhas atuais).
--   2. Aplicar no SQL Editor do Supabase:

ALTER TABLE payments
  ADD CONSTRAINT payments_businessdate_requires_paidat
  CHECK ("businessDate" IS NULL OR "paidAt" IS NOT NULL);

COMMENT ON CONSTRAINT payments_businessdate_requires_paidat ON payments IS
  'Dia contábil (businessDate) só em pagamento efetivado: cobrança não paga (paidAt NULL) nunca pode entrar na janela de receita do caixa/dashboard/relatórios.';
