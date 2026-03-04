-- ============================================
-- Migration: Integração Asaas Payment Gateway
-- Execute este SQL no Supabase Dashboard (SQL Editor)
-- ============================================

-- 1. Adicionar BOLETO ao enum PaymentMethod
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BOLETO';

-- 2. Adicionar campo asaasCustomerId na tabela clients
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT;

-- 3. Adicionar campos Asaas na tabela payments
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "asaasPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "asaasStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "billingType" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "pixQrCodeBase64" TEXT,
  ADD COLUMN IF NOT EXISTS "pixCopyPaste" TEXT,
  ADD COLUMN IF NOT EXISTS "bankSlipUrl" TEXT;

-- 4. Adicionar campo asaasSubscriptionId na tabela client_subscriptions
ALTER TABLE "client_subscriptions"
  ADD COLUMN IF NOT EXISTS "asaasSubscriptionId" TEXT;

-- 5. Índices para busca rápida por IDs do Asaas
CREATE INDEX IF NOT EXISTS "idx_clients_asaas_customer_id"
  ON "clients" ("asaasCustomerId")
  WHERE "asaasCustomerId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_payments_asaas_payment_id"
  ON "payments" ("asaasPaymentId")
  WHERE "asaasPaymentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_subscriptions_asaas_id"
  ON "client_subscriptions" ("asaasSubscriptionId")
  WHERE "asaasSubscriptionId" IS NOT NULL;
