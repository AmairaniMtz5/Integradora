-- Script SQL para crear/actualizar las tablas en Supabase
-- Ejecutar en: SQL Editor de Supabase Dashboard

-- 1. Crear tabla de usuarios (si no existe)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'patient',
  full_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear tabla de pacientes
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  medical_history TEXT,
  clinic TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Crear tabla de terapeutas
CREATE TABLE IF NOT EXISTS therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  specialization TEXT,
  professional_license TEXT,
  clinic TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Crear tabla de ejercicios
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  pathology TEXT,
  video_url TEXT,
  instructions TEXT,
  difficulty_level TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Crear tabla de historial
CREATE TABLE IF NOT EXISTS history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  notes TEXT,
  completed_at TIMESTAMP,
  duration_minutes INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS permisivas
-- Permitir inserciones sin restricciones (para desarrollo)
CREATE POLICY "allow_insert_users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_insert_patients" ON patients FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_insert_therapists" ON therapists FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_select_users" ON users FOR SELECT USING (true);
CREATE POLICY "allow_select_patients" ON patients FOR SELECT USING (true);
CREATE POLICY "allow_select_therapists" ON therapists FOR SELECT USING (true);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_therapists_user_id ON therapists(user_id);
CREATE INDEX IF NOT EXISTS idx_therapists_email ON therapists(email);
CREATE INDEX IF NOT EXISTS idx_history_patient_id ON history(patient_id);
CREATE INDEX IF NOT EXISTS idx_history_therapist_id ON history(therapist_id);
