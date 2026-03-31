-- Adicionar PENDING_PAYMENT ao enum AppointmentStatus
-- Necessário para agendamentos com pagamento online (PIX/cartão via Asaas)
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
