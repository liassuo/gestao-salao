-- Adiciona coluna para controlar primeiro login de clientes pré-cadastrados
-- Clientes importados diretamente no banco terão mustChangePassword = true
-- Quando o cliente definir sua senha pela primeira vez, o campo será atualizado para false

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN DEFAULT false;

-- Adiciona coluna para controlar primeiro login de profissionais
-- Profissionais criados pelo admin terão mustChangePassword = true
-- Quando o profissional definir sua senha pela primeira vez, o campo será atualizado para false

ALTER TABLE users
ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN DEFAULT false;

-- Para marcar clientes já existentes que não têm senha como precisando criar senha:
-- UPDATE clients SET "mustChangePassword" = true WHERE password IS NULL AND "googleId" IS NULL;
