-- ============================================================================
-- Migration: order_items.consumedSubscriptionCut + RPCs atômicas de débito/devolução
-- ============================================================================
-- Marca itens de comanda que consumiram um crédito da assinatura do cliente.
-- Quando true, o item foi zerado por estar incluído no plano (override 100% em
-- subscription_plan_services) e 1 corte foi debitado de
-- client_subscriptions.cutsUsedThisMonth. Ao remover/cancelar, o crédito é
-- devolvido.
--
-- IMPORTANTE: aplicar este SQL ANTES de subir o backend novo. Sem a coluna,
-- o INSERT em order_items falhará com "column ... does not exist".
-- ============================================================================

-- 1) Coluna na tabela order_items (idempotente)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS "consumedSubscriptionCut" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_order_items_consumed_cut
  ON order_items("consumedSubscriptionCut")
  WHERE "consumedSubscriptionCut" = true;

-- 2) RPC atômica de débito de cortes da assinatura.
--    Usa UPDATE incremental (PostgreSQL faz row lock automático na linha) — duas
--    chamadas concorrentes ficam serializadas, sem perder débitos.
--    Retorna o novo `cutsUsedThisMonth` ou NULL se a assinatura não existe.
CREATE OR REPLACE FUNCTION debit_subscription_cuts(
  sub_id TEXT,
  amount INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RETURN NULL;
  END IF;

  UPDATE client_subscriptions
  SET "cutsUsedThisMonth" = COALESCE("cutsUsedThisMonth", 0) + amount,
      "updatedAt" = NOW()
  WHERE id = sub_id
  RETURNING "cutsUsedThisMonth" INTO new_count;

  RETURN new_count;
END;
$$;

-- 3) RPC atômica de devolução (clamp em 0 — nunca fica negativo).
CREATE OR REPLACE FUNCTION refund_subscription_cuts(
  sub_id TEXT,
  amount INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RETURN NULL;
  END IF;

  UPDATE client_subscriptions
  SET "cutsUsedThisMonth" = GREATEST(0, COALESCE("cutsUsedThisMonth", 0) - amount),
      "updatedAt" = NOW()
  WHERE id = sub_id
  RETURNING "cutsUsedThisMonth" INTO new_count;

  RETURN new_count;
END;
$$;

-- 4) Permissões para a service_role (Nest usa SUPABASE_SERVICE_ROLE_KEY)
GRANT EXECUTE ON FUNCTION debit_subscription_cuts(TEXT, INTEGER) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION refund_subscription_cuts(TEXT, INTEGER) TO service_role, anon, authenticated;
