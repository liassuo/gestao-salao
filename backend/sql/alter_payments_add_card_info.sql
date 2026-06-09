-- Armazena APENAS os 4 últimos dígitos do cartão e a bandeira do pagamento.
-- O Asaas nunca expõe o número completo (só os 4 últimos via creditCard.creditCardNumber),
-- então isto é seguro/PCI-friendly: nada de número cheio, CVV ou validade.
-- Usado na tela de Assinaturas para o admin responder "qual cartão pagou?".
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "cardLast4" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "cardBrand" TEXT;
