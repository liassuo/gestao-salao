-- Habilita Row Level Security em todas as tabelas do schema public
-- exceto `notifications` (usada pelo frontend via Supabase Realtime com anon key).
--
-- Por que não criar policies:
--   - Backend usa SUPABASE_SERVICE_ROLE_KEY, que bypassa RLS automaticamente.
--   - Frontend só fala com o backend (HTTP). Não consulta o Postgres direto.
--   - Habilitar RLS sem policies = anon/authenticated não conseguem SELECT/INSERT/UPDATE/DELETE,
--     o que é EXATAMENTE o que queremos (fechar a brecha de "RLS Disabled in Public").
--
-- Exceção: `notifications` continua sem RLS porque o frontend assina mudanças via
--   Realtime (postgres_changes) usando a anon key. Se habilitarmos RLS, o
--   Realtime para de entregar eventos. TODO: mover Realtime pro backend
--   (Socket.IO/Nest gateway) e fechar essa última tabela.
--
-- Idempotente: ENABLE ROW LEVEL SECURITY pode ser chamado múltiplas vezes sem erro.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('notifications')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    RAISE NOTICE 'RLS enabled on %', tbl;
  END LOOP;
END $$;

-- Verificação: lista tabelas e estado de RLS
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
