-- Script para actualizar la tabla exercises y agregar campos necesarios
-- Ejecutar en: SQL Editor de Supabase Dashboard

-- Verificar columnas existentes y agregar las faltantes
DO $$ 
BEGIN
    -- Verificar si 'pathology' existe, si no, agregarla
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exercises' AND column_name='pathology') THEN
        ALTER TABLE exercises ADD COLUMN pathology TEXT;
    END IF;
END $$;

-- Hacer pathology_id NULLABLE (ya que usaremos pathology TEXT en su lugar)
ALTER TABLE exercises ALTER COLUMN pathology_id DROP NOT NULL;

-- Agregar columnas adicionales a la tabla exercises si no existen
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS video_id TEXT,
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📝',
ADD COLUMN IF NOT EXISTS meta TEXT,
ADD COLUMN IF NOT EXISTS media_ref JSONB,
ADD COLUMN IF NOT EXISTS media_name TEXT;

-- Crear índice para búsqueda rápida por patología
CREATE INDEX IF NOT EXISTS idx_exercises_pathology ON exercises(pathology);

-- Crear índice para búsqueda por video_id
CREATE INDEX IF NOT EXISTS idx_exercises_video_id ON exercises(video_id);

-- Actualizar política RLS para permitir lectura a todos los autenticados
DROP POLICY IF EXISTS "allow_read_exercises" ON exercises;
CREATE POLICY "allow_read_exercises" ON exercises FOR SELECT USING (true);

-- Permitir a admins insertar/actualizar/eliminar ejercicios
DROP POLICY IF EXISTS "allow_admin_exercises" ON exercises;
CREATE POLICY "allow_admin_exercises" ON exercises FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

COMMENT ON TABLE exercises IS 'Ejercicios predeterminados por patología, gestionados por administradores';
COMMENT ON COLUMN exercises.video_id IS 'ID del video en el manifest (ej: "ambas-rodillas-al-pecho")';
COMMENT ON COLUMN exercises.pathology IS 'Clave de patología (ej: "escoliosis", "hernia", "lumbalgia", "espondilolisis")';
COMMENT ON COLUMN exercises.media_ref IS 'Referencia al media: {type: "bundled|user", id: "..."}';
