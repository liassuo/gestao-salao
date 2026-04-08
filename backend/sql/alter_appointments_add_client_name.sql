-- Permitir agendamento rápido sem cliente cadastrado
-- Adiciona campo clientName para "cliente avulso" e torna clientId opcional

-- 1. Adicionar coluna clientName (nome livre para clientes não cadastrados)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "clientName" TEXT;

-- 2. Tornar clientId nullable (antes era NOT NULL)
ALTER TABLE appointments ALTER COLUMN "clientId" DROP NOT NULL;

-- 3. Também na tabela orders (comanda vinculada ao agendamento)
ALTER TABLE orders ALTER COLUMN "clientId" DROP NOT NULL;
