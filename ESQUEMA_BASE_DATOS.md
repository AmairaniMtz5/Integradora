# Esquema de Base de Datos - Supabase

## Tablas existentes (según tu captura):

### 1. users
- Tabla de autenticación de Supabase (manejada automáticamente)

### 2. patients (ESTRUCTURA REAL)
- **id**: UUID (primary key)
- **user_id**: UUID (foreign key → auth.users) - **AGREGADA**
- **first_name**: text
- **last_name**: text
- **email**: text
- **phone**: text
- **age**: integer
- **date_of_birth**: date
- **gender**: text
- **clinic**: text
- **medical_history**: text
- **profile_photo_url**: text - **OPCIONAL: Para foto de perfil**
- **therapist_id**: UUID (foreign key → therapists)
- **created_at**: timestamp with time zone
- **updated_at**: timestamp with time zone

**COLUMNAS OPCIONALES A AGREGAR:**
```sql
-- Si no existe profile_photo_url
ALTER TABLE patients ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
```

### 3. exercise_history (ESTRUCTURA REAL)
- **id**: UUID (primary key)
- **patient_id**: UUID (foreign key → patients.id)
- **exercise_id**: UUID (foreign key → exercises.id)
- **therapist_id**: UUID (foreign key → therapists.id)
- **date_performed**: timestamp with time zone
- **duration_seconds**: integer
- **repetitions**: integer
- **status**: text (ej: 'completed', 'skipped', 'in_progress')
- **notes**: text
- **created_at**: timestamp with time zone
- **updated_at**: timestamp with time zone

### 4. pathologies
- **id**: bigint (primary key)
- **name**: text
- **description**: text

### 5. exercises
- **id**: bigint (primary key)
- **name**: text
- **pathology_id**: bigint (foreign key → pathologies)
- **video_url**: text

### 6. therapists
- **id**: bigint (primary key)
- **user_id**: UUID (foreign key → auth.users)
- **name**: text
- **email**: text

### 7. assigned_exercises
- **id**: bigint (primary key)
- **patient_id**: bigint (foreign key → patients.id)
- **exercise_id**: bigint (foreign key → exercises.id)
- **assigned_by**: bigint (foreign key → therapists.id)
- **assigned_date**: timestamp

### 8. patient_exercises
- **id**: bigint (primary key)
- **patient_id**: bigint (foreign key → patients.id)
- **exercise_id**: bigint (foreign key → exercises.id)
- **completed**: boolean
- **completion_date**: timestamp

### 9. reports
- **id**: bigint (primary key)
- **patient_id**: bigint (foreign key → patients.id)
- **therapist_id**: bigint (foreign key → therapists.id)
- **report_date**: timestamp
- **content**: text

## Verificación de columnas requeridas

### Para que la app móvil funcione correctamente, necesitas verificar:

1. **Tabla `patients` debe tener:**
   - `user_id` (UUID)
   - `name` (text)
   - `age` (integer)
   - `email` (text)
   - `pathology_id` (bigint, opcional)

2. **Tabla `exercise_history` debe tener:**
   - `patient_id` (bigint)
   - `date` (timestamp)
   - `completed_exercises` (integer)
   - `total_exercises` (integer)
   - `errors` (integer)
   - `repetitions` (integer)
   - `skipped_exercises` (integer)
   - `notes` (text, opcional)

## Políticas de seguridad (RLS - Row Level Security)

Para que la app móvil pueda acceder a los datos, necesitas habilitar políticas:

```sql
-- Habilitar RLS en las tablas
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_history ENABLE ROW LEVEL SECURITY;

-- Permitir a los usuarios ver/editar solo sus propios datos
CREATE POLICY "Users can view own patient data" 
ON patients FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own patient data" 
ON patients FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patient data" 
ON patients FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own exercise history" 
ON exercise_history FOR SELECT 
USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own exercise history" 
ON exercise_history FOR INSERT 
WITH CHECK (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
```

## Notas importantes

- NO ejecutes líneas que empiecen con "-" (son comentarios)
- Copia y pega solo el código SQL completo
- Ejecuta las políticas en el SQL Editor de Supabase
