-- ===========================================
-- LIMPAR TODAS AS TABELAS
-- Mantém apenas o usuario admin@barbearia.com
-- ===========================================

BEGIN;

-- Nivel 4 (mais dependentes primeiro)
DELETE FROM "OrderItem";
DELETE FROM "Order";

-- Nivel 3
DELETE FROM "AppointmentService";
DELETE FROM "Commission";
DELETE FROM "StockMovement";
DELETE FROM "Payment";
DELETE FROM "Debt";

-- Nivel 2
DELETE FROM "Appointment";
DELETE FROM "ClientSubscription";
DELETE FROM "TimeBlock";
DELETE FROM "FinancialTransaction";
DELETE FROM "Product";

-- Nivel 1
DELETE FROM "CashRegister";
DELETE FROM "FinancialCategory";
DELETE FROM "Professional";
DELETE FROM "Service";

-- Nivel 0 (tabelas base)
DELETE FROM "Client";
DELETE FROM "Branch";
DELETE FROM "SubscriptionPlan";
DELETE FROM "BankAccount";
DELETE FROM "PaymentMethodConfig";

-- Limpa usuarios EXCETO o admin
DELETE FROM "User" WHERE email != 'admin@barbearia.com';

COMMIT;
