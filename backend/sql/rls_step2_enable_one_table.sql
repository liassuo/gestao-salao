-- ETAPA 2: TESTE EM UMA ÚNICA TABELA primeiro
-- Habilita RLS em `time_blocks` (tabela de baixo risco — bloqueios de
-- horário do calendário, fluxo isolado, fácil de testar manualmente).
--
-- Depois de rodar:
--   1. Subir o backend e fazer login no admin
--   2. Abrir o calendário e tentar criar um bloqueio de horário
--   3. Tentar listar bloqueios existentes
--   4. Se tudo funcionar → service_role está bypassando RLS corretamente.
--      Pode rodar a etapa 3 (todas as tabelas).
--   5. Se quebrar → rodar rls_rollback_one_table.sql

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

-- Verifica
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'time_blocks';
