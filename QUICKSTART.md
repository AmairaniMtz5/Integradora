Obsoleto. Ver DOCUMENTACION_UNICA.md

## 🎯 Pasos para conectar tu aplicación

### Paso 1: Crear Proyecto en Supabase (2 minutos)

1. Ve a [supabase.com](https://supabase.com)
2. Haz clic en "New Project"
3. Rellena los datos:
   - **Project name**: `integradora-terapia`
   - **Database Password**: Usa contraseña segura (10+ caracteres)
   - **Region**: Elige la más cercana a tu ubicación
4. Espera a que se cree (puede tomar 1-2 minutos)

### Paso 2: Obtener las credenciales (1 minuto)

1. En tu proyecto, ve a **Settings** → **API**
2. Copia y guarda en lugar seguro:
   - **Project URL** (ejemplo: `https://xxxxx.supabase.co`)
   - **anon public key** (empieza con `eyJ...`)

### Paso 3: Configurar el código (1 minuto)

1. Abre `front-end/shared/supabase-client.js`
2. Reemplaza estas líneas:
```javascript
// ANTES
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// DESPUÉS (con tus valores reales)
const SUPABASE_URL = 'https://abcdef123456.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Paso 4: Crear las tablas (3 minutos)

1. En tu proyecto Supabase, ve a **SQL Editor**
2. Haz clic en **"New Query"**
3. Copia TODO el contenido de la sección **SQL de las tablas** (más abajo)
4. Haz clic en **"Run"**
5. Espera a que terminen (sin errores)

### Paso 5: Probar conexión (1 minuto)

1. Abre tu navegador en la carpeta del proyecto
2. Abre la consola (F12)
3. Ejecuta:
```javascript
console.log(window.SupabaseConfig.isConfigured());
```
4. Debe mostrar `true`

¡Listo! 🎉

---

## 📋 SQL de las tablas

Copia TODO esto en el SQL Editor de Supabase:

```sql
-- ============================================
-- TABLA: users (administradores, terapeutas, pacientes)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'therapist', 'patient')) DEFAULT 'patient',
  clinic TEXT,
  phone TEXT,
  professional_license TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- TABLA: patients
-- ============================================
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('M', 'F', 'Other')),
  clinic TEXT,
  medical_history TEXT,
  therapist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists can view assigned patients"
  ON patients FOR SELECT
  USING (
    auth.uid() = therapist_id OR
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Admins can view all patients"
  ON patients FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- TABLA: therapists
-- ============================================
CREATE TABLE therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  clinic TEXT,
  specialization TEXT,
  professional_license TEXT,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all therapists"
  ON therapists FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- TABLA: pathologies
-- ============================================
CREATE TABLE pathologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pathologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pathologies"
  ON pathologies FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insertar patologías de ejemplo
INSERT INTO pathologies (name, description) VALUES
  ('Escoliosis lumbar', 'Curvatura anormal de la columna vertebral'),
  ('Espondilólisis', 'Fractura por estrés en la vértebra'),
  ('Hernia de disco lumbar', 'Desplazamiento del disco intervertebral'),
  ('Lumbalgia mecánica inespecífica', 'Dolor lumbar de origen mecánico');

-- ============================================
-- TABLA: exercises
-- ============================================
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  pathology_id UUID NOT NULL REFERENCES pathologies(id) ON DELETE CASCADE,
  video_url TEXT,
  video_path TEXT,
  instructions TEXT,
  duration_minutes INTEGER DEFAULT 0,
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view exercises"
  ON exercises FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- TABLA: exercise_history
-- ============================================
CREATE TABLE exercise_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  date_performed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT CHECK (status IN ('completed', 'skipped', 'incomplete')) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE exercise_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists can view patient history"
  ON exercise_history FOR SELECT
  USING (
    therapist_id = auth.uid() OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================
-- TABLA: patient_exercises (asignaciones)
-- ============================================
CREATE TABLE patient_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  target_completion_date DATE,
  frequency_per_week INTEGER DEFAULT 3,
  sets INTEGER DEFAULT 3,
  reps INTEGER DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, exercise_id)
);

ALTER TABLE patient_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists can view assigned exercises"
  ON patient_exercises FOR SELECT
  USING (therapist_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- TABLA: reports
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists can view patient reports"
  ON reports FOR SELECT
  USING (therapist_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');
```

---

## ✅ Checklist Final

- [ ] Cuenta de Supabase creada
- [ ] Proyecto creado
- [ ] Credenciales copiadas
- [ ] `supabase-client.js` configurado
- [ ] SQL ejecutado sin errores
- [ ] Consola muestra `true` en test
- [ ] Listo para desarrollar!

---

## 🚀 Próximos pasos

1. **Incluye los scripts en tu HTML**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/shared/supabase-client.js"></script>
<script src="/shared/supabase-auth.js"></script>
<script src="/shared/supabase-patients.js"></script>
<script src="/shared/supabase-therapists.js"></script>
<script src="/shared/supabase-exercises.js"></script>
<script src="/shared/supabase-history.js"></script>
```

2. **Usa las funciones en tu código**
```javascript
// Login
const result = await window.SupabaseAuth.signIn(email, password);

// Obtener pacientes
const result = await window.SupabasePatients.getPatients();

// Crear ejercicio
const result = await window.SupabaseExercises.createExercise({...});
```

3. **Revisa los ejemplos**
Consulta `SUPABASE_EXAMPLES.md` para más detalles

---

## 🆘 Problemas comunes

**Error: "Supabase is not defined"**
→ Asegúrate de incluir el script CDN ANTES de `supabase-client.js`

**Error: "Invalid API key"**
→ Verifica que copiaste bien las credenciales

**Los datos no se guardan**
→ Revisa la consola (F12) para ver errores específicos

---

¡Éxito! 🎉
