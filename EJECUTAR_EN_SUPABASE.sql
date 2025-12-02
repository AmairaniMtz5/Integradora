-- ============================================================================
-- INSTRUCCIONES PARA EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================================
-- 1. Ve a tu proyecto Supabase
-- 2. Abre el SQL Editor
-- 3. Copia y pega TODO este código
-- 4. Haz clic en "Run" o presiona Ctrl+Enter
-- ============================================================================

-- Crear tabla para indicadores de escritura
CREATE TABLE IF NOT EXISTS typing_status (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_partner_id)
);

-- Habilitar Row Level Security
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver el estado de escritura de su pareja de conversación
CREATE POLICY "Users can read typing status"
ON typing_status
FOR SELECT
USING (
  auth.uid() = conversation_partner_id
);

-- Política: Los usuarios pueden actualizar su propio estado de escritura
CREATE POLICY "Users can update their typing status"
ON typing_status
FOR ALL
USING (
  auth.uid() = user_id
);

-- Habilitar Realtime para la tabla typing_status
ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;

-- ============================================================================
-- VERIFICACIÓN (Opcional - puedes ejecutar esto después para verificar)
-- ============================================================================
-- SELECT * FROM typing_status;
-- ============================================================================
