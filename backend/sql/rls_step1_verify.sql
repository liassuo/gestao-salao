-- ETAPA 1: VERIFICAR estado atual antes de habilitar RLS
-- Rode isso primeiro pra ver quais tabelas estão com/sem RLS hoje.
-- Não altera nada.

SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '⚠️  RLS OFF' END AS estado,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) AS num_policies
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;
