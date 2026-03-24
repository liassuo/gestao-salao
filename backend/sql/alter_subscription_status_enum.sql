-- Adicionar novos valores ao enum SubscriptionStatus
-- Necessário para suportar PENDING_PAYMENT e SUSPENDED

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
