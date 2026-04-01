-- Vincula comanda ao agendamento que a gerou
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "appointmentId" TEXT REFERENCES appointments(id) ON DELETE SET NULL;
