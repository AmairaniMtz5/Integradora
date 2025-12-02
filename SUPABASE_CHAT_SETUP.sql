-- ====================================
-- CONFIGURACIÓN DE CHAT EN SUPABASE
-- ====================================
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  deleted_by_sender BOOLEAN DEFAULT FALSE,
  deleted_by_receiver BOOLEAN DEFAULT FALSE
);

-- Tabla para el estado de "escribiendo"
CREATE TABLE IF NOT EXISTS typing_status (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_partner_id)
);

-- 2. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_typing_status_user ON typing_status(user_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_partner ON typing_status(conversation_partner_id);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de seguridad

-- Los usuarios pueden leer los mensajes donde son sender o receiver
CREATE POLICY "Users can read their own messages"
ON messages
FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Los usuarios pueden insertar mensajes donde son el sender
CREATE POLICY "Users can send messages"
ON messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
);

-- Los usuarios pueden actualizar mensajes donde son sender o receiver (para marcar como leídos o eliminados)
CREATE POLICY "Users can update their messages"
ON messages
FOR UPDATE
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Los usuarios pueden eliminar mensajes donde son sender o receiver
CREATE POLICY "Users can delete their own messages"
ON messages
FOR DELETE
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Políticas para typing_status
CREATE POLICY "Users can read typing status"
ON typing_status
FOR SELECT
USING (
  auth.uid() = user_id OR auth.uid() = conversation_partner_id
);

CREATE POLICY "Users can update their typing status"
ON typing_status
FOR ALL
USING (
  auth.uid() = user_id
);

-- 5. Crear vista para obtener conversaciones con último mensaje
CREATE OR REPLACE VIEW conversations_view AS
SELECT DISTINCT ON (conversation_key)
  CASE 
    WHEN sender_id < receiver_id 
    THEN sender_id || '_' || receiver_id
    ELSE receiver_id || '_' || sender_id
  END as conversation_key,
  sender_id,
  receiver_id,
  message as last_message,
  created_at as last_message_time,
  read
FROM messages
ORDER BY conversation_key, created_at DESC;

-- 6. Habilitar Realtime para la tabla messages
-- (Esto se debe hacer en el Dashboard de Supabase: Database > Replication)
-- O ejecutar:
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;

-- ====================================
-- VERIFICACIÓN
-- ====================================
-- Para verificar que todo está configurado correctamente:

-- Ver estructura de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages';

-- Ver políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'messages';
