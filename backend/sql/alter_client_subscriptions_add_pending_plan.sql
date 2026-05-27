-- Troca de plano "lazy" (downgrade/lateral): cliente marcou que quer mudar de
-- plano, mas a troca so acontece na proxima renovacao para nao perder o ciclo
-- que ele ja pagou. pendingPlanId aponta para o plano-alvo. Quando endDate
-- vencer (renovacao via webhook Asaas ou cron), o sistema renova ja com o
-- pendingPlanId no lugar do planId atual e limpa esse campo.
--
-- NULL = sem troca agendada (caso comum).
ALTER TABLE client_subscriptions
  ADD COLUMN IF NOT EXISTS "pendingPlanId" TEXT
    REFERENCES subscription_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_pending_plan
  ON client_subscriptions("pendingPlanId")
  WHERE "pendingPlanId" IS NOT NULL;
