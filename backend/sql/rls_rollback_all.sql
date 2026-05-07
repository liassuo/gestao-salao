-- ROLLBACK COMPLETO — desabilita RLS em todas as tabelas do schema public.
-- Use se a etapa 3 (enable_rls_all_tables.sql) quebrou alguma coisa.
-- Idempotente.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', tbl);
    RAISE NOTICE 'RLS disabled on %', tbl;
  END LOOP;
END $$;

SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
