-- ============================================
-- Sistema de Notificações In-App (Real-time)
-- ============================================

-- 1. Criar tabela notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id text REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  action_url text,
  entity_type text,
  entity_id text,
  group_key text,
  metadata jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- 2. Índices
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_recipient_unread ON notifications(recipient_id, read) WHERE archived = false;
CREATE INDEX idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_group_key ON notifications(recipient_id, group_key) WHERE read = false;

-- 3. RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para Realtime funcionar (segurança real é via API + filtro de subscription)
CREATE POLICY "Allow read for realtime"
  ON notifications FOR SELECT USING (true);

-- Service role insere notificações (backend)
CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);

-- Service role atualiza (backend)
CREATE POLICY "Allow update for service"
  ON notifications FOR UPDATE USING (true) WITH CHECK (true);

-- Service role deleta (backend)
CREATE POLICY "Allow delete for service"
  ON notifications FOR DELETE USING (true);

-- 4. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- IMPORTANTE: Verificar no Supabase Dashboard:
-- Database > Replication > supabase_realtime → toggle da tabela notifications ativo
