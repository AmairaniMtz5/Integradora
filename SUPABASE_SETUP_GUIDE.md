Obsoleto. Ver DOCUMENTACION_UNICA.md

## 📋 Descripción General

Esta guía explica cómo configurar e integrar **Supabase** en tu aplicación de terapia física. Supabase proporciona:

- ✅ **Base de datos PostgreSQL** completamente administrada
- ✅ **Autenticación** integrada (JWT, OAuth, etc.)
- ✅ **API REST** automática
- ✅ **Almacenamiento de archivos** (para videos)
- ✅ **Real-time subscriptions**

---

## 🚀 Paso 1: Configurar Supabase

### 1.1 Crear una cuenta en Supabase

1. Visita [https://supabase.com](https://supabase.com)
2. Haz clic en **"Start your project"**
3. Inicia sesión con GitHub o crea una cuenta
4. Crea un nuevo proyecto:
   - **Project name**: `integradora-terapia` (o el nombre que prefieras)
   - **Database Password**: Usa una contraseña segura
   - **Region**: Selecciona la región más cercana a tu ubicación

### 1.2 Obtener las credenciales

Una vez creado el proyecto:

1. Ve a **Settings** → **API**
2. Copia:
   - **Project URL**: Esta es tu `SUPABASE_URL`
   - **anon public key**: Esta es tu `SUPABASE_ANON_KEY`

### 1.3 Actualizar la configuración

Abre `front-end/shared/supabase-client.js` y reemplaza:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

Con tus valores reales:

```javascript
const SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

## 📊 Paso 2: Crear Tablas en la Base de Datos

### 2.1 Acceder al Editor SQL

1. En tu proyecto de Supabase, ve a **SQL Editor**
2. Haz clic en **"New Query"**

### 2.2 Crear tabla de usuarios

Ejecuta el siguiente SQL:

```sql
-- Tabla de usuarios (administradores, terapeutas, pacientes)
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

-- Habilitar RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Política: Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

### 2.3 Crear tabla de pacientes

```sql
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

-- Los terapeutas pueden ver los pacientes asignados
CREATE POLICY "Therapists can view assigned patients"
  ON patients FOR SELECT
  USING (
    auth.uid() = therapist_id OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- Los administradores pueden ver todos los pacientes
CREATE POLICY "Admins can view all patients"
  ON patients FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

### 2.4 Crear tabla de terapeutas

```sql
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

-- Los administradores pueden ver todos los terapeutas
CREATE POLICY "Admins can view all therapists"
  ON therapists FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

### 2.5 Crear tabla de patologías

```sql
CREATE TABLE pathologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pathologies ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver las patologías
CREATE POLICY "Authenticated users can view pathologies"
  ON pathologies FOR SELECT
  USING (auth.role() = 'authenticated');
```

### 2.6 Crear tabla de ejercicios

```sql
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

-- Todos los usuarios autenticados pueden ver los ejercicios
CREATE POLICY "Authenticated users can view exercises"
  ON exercises FOR SELECT
  USING (auth.role() = 'authenticated');
```

### 2.7 Crear tabla de historial de ejercicios

```sql
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

-- Los terapeutas pueden ver el historial de sus pacientes
CREATE POLICY "Therapists can view patient history"
  ON exercise_history FOR SELECT
  USING (
    therapist_id = auth.uid() OR
    auth.jwt() ->> 'role' = 'admin'
  );
```

### 2.8 Crear tabla de asignaciones de ejercicios

```sql
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

-- Los terapeutas pueden ver los ejercicios asignados a sus pacientes
CREATE POLICY "Therapists can view assigned exercises"
  ON patient_exercises FOR SELECT
  USING (therapist_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');
```

### 2.9 Crear tabla de reportes

```sql
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

-- Los terapeutas pueden ver los reportes de sus pacientes
CREATE POLICY "Therapists can view patient reports"
  ON reports FOR SELECT
  USING (therapist_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');
```

---

## 🔐 Paso 3: Configurar Autenticación

### 3.1 Habilitar proveedores de autenticación

1. Ve a **Authentication** → **Providers**
2. Habilita:
   - ✅ **Email** (para login con email/password)
   - ✅ (Opcional) Google, GitHub, etc.

### 3.2 Configurar URLs de redirección

1. Ve a **Authentication** → **URL Configuration**
2. Agrega las siguientes URLs bajo **Redirect URLs**:
   - `http://localhost:3000/` (para desarrollo local)
   - `http://localhost:3000/Administrador/Dashboard/dashboard-admin.html`
   - `http://localhost:3000/Terapeuta/Dashboard/dashboardt.html`
   - `https://tu-dominio.com/` (cuando despliegues)

---

## 📦 Paso 4: Instalar Supabase JS en el Frontend

### 4.1 Opción 1: Usar CDN (Más fácil)

Abre `front-end/Administrador/login/index.html` y agrega estas líneas antes de tus scripts:

```html
<!-- Supabase JS -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Nuestros módulos de Supabase -->
<script src="/shared/supabase-client.js"></script>
<script src="/shared/supabase-auth.js"></script>
<script src="/shared/supabase-patients.js"></script>
<script src="/shared/supabase-therapists.js"></script>
<script src="/shared/supabase-exercises.js"></script>
<script src="/shared/supabase-history.js"></script>
```

### 4.2 Opción 2: Usar npm (Más recomendado para proyectos grandes)

```bash
npm init -y
npm install @supabase/supabase-js
```

Luego importa en tu código:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

---

## 🔧 Paso 5: Integrar con tu Login Existente

Abre `front-end/Administrador/login/login.js` y reemplaza la sección de autenticación:

```javascript
// Antes (usando localStorage)
const localUser = window.localStore.authenticate(email, password, selectedRole);

// Después (usando Supabase)
const result = await window.SupabaseAuth.signIn(email, password);
if (result.success) {
  const user = result.user;
  const profile = result.profile;
  
  // Validar rol
  if (profile && profile.role !== selectedRole) {
    showMessage("Este usuario no pertenece al rol seleccionado", "error");
    return;
  }
  
  // Redirigir según el rol
  setTimeout(() => {
    if (profile.role === 'terapeuta' || profile.role === 'therapist') {
      window.location.href = "/Terapeuta/Dashboard/dashboardt.html";
    } else if (profile.role === 'admin') {
      window.location.href = "/Administrador/Dashboard/dashboard-admin.html";
    } else {
      window.location.href = "/Pacientes/pacientes.html";
    }
  }, 300);
} else {
  showMessage(result.error, 'error');
}
```

---

## 💾 Paso 6: Usar los Módulos en tu Código

### Obtener pacientes

```javascript
const result = await window.SupabasePatients.getPatients();
if (result.success) {
  console.log(result.data); // Array de pacientes
} else {
  console.error(result.error);
}
```

### Crear un nuevo paciente

```javascript
const result = await window.SupabasePatients.createPatient({
  firstName: 'Juan',
  lastName: 'Pérez',
  email: 'juan@example.com',
  phone: '+34 123 456 789',
  clinic: 'Clínica ABC'
});

if (result.success) {
  console.log('Paciente creado:', result.data);
}
```

### Obtener ejercicios por patología

```javascript
const result = await window.SupabaseExercises.getExercisesByPathology(pathologyId);
if (result.success) {
  result.data.forEach(exercise => {
    console.log(exercise.name);
  });
}
```

### Crear historial de ejercicio

```javascript
const result = await window.SupabaseHistory.createHistory({
  patientId: 'patient-uuid',
  exerciseId: 'exercise-uuid',
  therapistId: 'therapist-uuid',
  durationSeconds: 300,
  repetitions: 15,
  notes: 'Ejercicio completado sin problemas',
  status: 'completed'
});
```

---

## 📁 Paso 7: Almacenar Videos en Supabase Storage

### 7.1 Crear un bucket para videos

1. Ve a **Storage** en Supabase
2. Haz clic en **"Create a new bucket"**
3. Nombre: `exercise-videos`
4. Privacidad: **Private** (configurable según necesidades)

### 7.2 Subir videos

```javascript
async function uploadVideo(file, pathologyName, exerciseName) {
  const { data, error } = await window.supabaseClient
    .storage
    .from('exercise-videos')
    .upload(`${pathologyName}/${exerciseName}.mp4`, file);
  
  if (error) {
    console.error('Error uploading video:', error);
    return null;
  }
  
  return data;
}
```

### 7.3 Obtener URL pública de video

```javascript
const { data } = window.supabaseClient
  .storage
  .from('exercise-videos')
  .getPublicUrl(`${pathologyName}/${exerciseName}.mp4`);

console.log(data.publicUrl);
```

---

## 🛡️ Configuración de Seguridad

### Políticas de RLS (Row Level Security)

Todas las tablas tienen políticas de RLS habilitadas. Asegúrate de:

1. ✅ Los usuarios solo ven datos permitidos según su rol
2. ✅ Usar variables JWT para políticas avanzadas
3. ✅ Revisar permisos regularmente

### Variables de entorno (Opcional pero recomendado)

Crea un archivo `.env` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🧪 Paso 8: Pruebas

### Verificar conexión

Abre la consola del navegador (F12) y ejecuta:

```javascript
console.log(window.SupabaseConfig.isConfigured()); // Debe ser true
console.log(window.supabaseClient); // Debe mostrar el cliente
```

### Probar autenticación

```javascript
const result = await window.SupabaseAuth.signIn('test@example.com', 'password');
console.log(result);
```

---

## 📱 Aplicaciones Móviles (Futuro)

Cuando quieras crear apps móviles:

1. Usa **React Native** + `@supabase/supabase-js`
2. Usa **Flutter** + `supabase-flutter`
3. Usa **Expo** para desarrollo rápido

---

## 🆘 Troubleshooting

### Error: "Supabase library not loaded"
→ Asegúrate de incluir el script CDN antes de `supabase-client.js`

### Error: "Invalid API key"
→ Verifica que copiaste correctamente `SUPABASE_ANON_KEY`

### Error: "CORS policy"
→ Configura URLs de redirección en Supabase Settings → Authentication

### RLS policies blocking access
→ Revisa las políticas en cada tabla y asegúrate que el usuario tiene permisos

---

## 📞 Recursos Útiles

- 📖 [Documentación oficial de Supabase](https://supabase.com/docs)
- 🎓 [Ejemplos de código](https://github.com/supabase/supabase/tree/master/examples)
- 💬 [Comunidad de Supabase](https://discord.supabase.com)

---

## Checklist de Implementación

- [ ] Cuenta de Supabase creada
- [ ] Credenciales agregadas a `supabase-client.js`
- [ ] Tablas creadas en la BD
- [ ] Scripts Supabase incluidos en HTML
- [ ] Login integrado con `SupabaseAuth`
- [ ] Pacientes funcionales con `SupabasePatients`
- [ ] Terapeutas funcionales con `SupabaseTherapists`
- [ ] Ejercicios funcionales con `SupabaseExercises`
- [ ] Historial funcional con `SupabaseHistory`
- [ ] Videos subidos a Storage
- [ ] Pruebas completadas
- [ ] Despliegue en producción

¡Listo! Tu aplicación ya está conectada a Supabase. 🎉
