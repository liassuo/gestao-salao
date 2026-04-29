-- Tabela de férias dos profissionais.
-- Períodos em que o profissional NÃO atende. Bloqueia agendamentos
-- (web/app cliente e painel admin) entre startDate e endDate (inclusivo).
--
-- IMPORTANTE: usamos DATE (sem horário/timezone) para evitar drift de fuso.
-- "férias do dia 24/05 até 30/05" = startDate=2026-05-24, endDate=2026-05-30.
-- O cliente vê essa string formatada exatamente como cadastrada, sem
-- conversões UTC que poderiam mostrar 23/05 ou 31/05.

-- professionals.id é TEXT (gerado pelo Prisma como cuid/uuid string).
-- Por isso "professionalId" também é TEXT — caso contrário o Postgres rejeita o FK.
CREATE TABLE IF NOT EXISTS professional_vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "professionalId" TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  reason TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT professional_vacations_dates_chk CHECK ("endDate" >= "startDate")
);

CREATE INDEX IF NOT EXISTS idx_prof_vacations_professional
  ON professional_vacations("professionalId");
CREATE INDEX IF NOT EXISTS idx_prof_vacations_range
  ON professional_vacations("professionalId", "startDate", "endDate");
