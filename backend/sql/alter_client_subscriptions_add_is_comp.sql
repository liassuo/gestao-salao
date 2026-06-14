-- Assinatura CORTESIA: concedida grátis pelo admin (cliente "ganha" o plano por um
-- período, limite 1 mês). isComp=true marca que o CICLO ATIVO atual é cortesia —
-- nasce ACTIVE sem pagamento, sem cobrança Asaas e sem dívida.
--
-- Usada pelos pontos que vencem assinaturas (cron suspendExpiredActiveSubscriptionsCron
-- e o auto-suspend de findClientSubscription): uma cortesia vencida vira EXPIRED (sem
-- gerar inadimplência), em vez de SUSPENDED + dívida como uma assinatura paga que lapsa.
--
-- É resetada para false em qualquer (re)ativação PAGA (balcão/Asaas), para que, depois
-- de o cliente renovar pagando, um lapso futuro volte a cobrar normalmente.
ALTER TABLE client_subscriptions
  ADD COLUMN IF NOT EXISTS "isComp" BOOLEAN NOT NULL DEFAULT false;
