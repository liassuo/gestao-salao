-- ROLLBACK da etapa 2 — desabilita RLS em time_blocks
-- Use se a etapa 2 quebrou alguma coisa.

ALTER TABLE public.time_blocks DISABLE ROW LEVEL SECURITY;

SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'time_blocks';
