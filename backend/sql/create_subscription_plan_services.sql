-- Tabela de junção: serviços com desconto específico por plano de assinatura.
-- Quando o cliente tiver assinatura ACTIVE de um plano, o desconto definido aqui
-- prevalece sobre o discountPercent global do plano e sobre promoções (se maior).
-- Quando o serviço NÃO estiver listado no plano, cai no discountPercent global.

CREATE TABLE IF NOT EXISTS subscription_plan_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "planId" TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  "serviceId" TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  "discountPercent" INTEGER NOT NULL DEFAULT 0
    CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE ("planId", "serviceId")
);

CREATE INDEX IF NOT EXISTS idx_sub_plan_services_plan ON subscription_plan_services("planId");
CREATE INDEX IF NOT EXISTS idx_sub_plan_services_service ON subscription_plan_services("serviceId");
