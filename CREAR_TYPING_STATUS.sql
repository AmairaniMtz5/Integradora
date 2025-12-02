-- ============================================================================
-- CREAR SOLO LA TABLA typing_status Y SUS CONFIGURACIONES
-- ============================================================================
-- Ejecuta este script en el SQL Editor de Supabase

-- Eliminar la tabla si existe (para empezar limpio)
DROP TABLE IF EXISTS typing_status CASCADE;

-- Crear tabla para el estado de "escribiendo"
CREATE TABLE typing_status (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_partner_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_typing_status_user ON typing_status(user_id);
CREATE INDEX idx_typing_status_partner ON typing_status(conversation_partner_id);

-- Habilitar Row Level Security
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver el estado de escritura (tanto el suyo como el de su pareja)
CREATE POLICY "Users can read typing status"
ON typing_status
FOR SELECT
USING (
  auth.uid() = user_id OR auth.uid() = conversation_partner_id
);

-- Política: Los usuarios pueden actualizar/insertar/eliminar su propio estado de escritura
CREATE POLICY "Users can update their typing status"
ON typing_status
FOR ALL
USING (
  auth.uid() = user_id
);

-- Habilitar Realtime para la tabla typing_status
ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Verificar que la tabla se creó correctamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'typing_status';

-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'typing_status';
