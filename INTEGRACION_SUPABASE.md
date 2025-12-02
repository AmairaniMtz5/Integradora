# Integración de Supabase - App Móvil

## ✅ Completado

### 1. Autenticación (LoginScreen.js)
- Login con email/password usando `supabase.auth.signInWithPassword()`
- Eliminado fallback hardcoded
- Validación de usuario autenticado

### 2. Perfil del Paciente (PerfilScreen.js)
- Carga datos de tabla `patients` usando `user_id`
- Campos: `first_name`, `last_name`, `age`, `email`, `medical_history`
- Guarda cambios con `upsert()` automático
- Estados de loading y saving

### 3. Historial de Ejercicios (HistorialScreen.js)
- Carga de tabla `exercise_history` filtrado por `patient_id`
- Transforma datos: `date_performed`, `status`, `repetitions`
- Muestra ejercicios completados, errores, omitidos

### 4. Ejercicios Asignados (VideoRefScreen.js)
- **NUEVO**: Carga ejercicios desde `assigned_exercises` al iniciar
- Muestra nombre del paciente: "Hola, [first_name] [last_name]"
- Lista ejercicios con nombre y patología asociada
- Fallback a lista estática si no hay ejercicios asignados

## 📋 Estructura de Base de Datos

### Tablas utilizadas:

#### `patients`
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users) ← AGREGADA
- first_name (text)
- last_name (text)
- email (text)
- age (integer)
- medical_history (text)
```

#### `exercise_history`
```sql
- id (UUID, PK)
- patient_id (UUID, FK → patients.id)
- date_performed (timestamp)
- repetitions (integer)
- duration_seconds (integer)
- status (text) ← 'completed', 'skipped'
- notes (text)
```

#### `assigned_exercises`
```sql
- id (UUID, PK)
- patient_id (UUID, FK → patients.id)
- exercise_id (UUID, FK → exercises.id)
- assigned_by (UUID, FK → therapists.id)
```

#### `exercises`
```sql
- id (UUID, PK)
- name (text)
- video_url (text)
- pathology_id (UUID, FK → pathologies.id)
```

## 🔒 Políticas de Seguridad (RLS)

```sql
-- Ejecutado en Supabase SQL Editor
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_history ENABLE ROW LEVEL SECURITY;

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

## 🛠️ Funciones de Utilidad

### `utils/supabaseHelpers.js`

#### `saveExerciseSession(sessionData)`
Guarda una sesión de ejercicio en `exercise_history`.

**Parámetros:**
```javascript
{
  completed_exercises: number,  // Ejercicios completados
  total_exercises: number,      // Total de ejercicios
  errors: number,               // Errores cometidos
  repetitions: number,          // Repeticiones totales
  skipped_exercises: number,    // Ejercicios omitidos
  duration_seconds: number,     // Duración en segundos
  pathology: string            // Nombre de la patología
}
```

**Ejemplo de uso en VideoRefScreen:**
```javascript
import { saveExerciseSession } from '../utils/supabaseHelpers';

// Cuando el usuario complete la sesión:
const handleFinishSession = async () => {
  const result = await saveExerciseSession({
    completed_exercises: completedCount,
    total_exercises: assignedExercises.length,
    errors: errorCount,
    repetitions: totalReps,
    skipped_exercises: skippedCount,
    duration_seconds: sessionDuration,
    pathology: selectedCondition
  });

  if (result.success) {
    Alert.alert('✅ Éxito', 'Sesión guardada correctamente');
  } else {
    console.log('No se pudo guardar el historial:', result.error);
  }
  
  navigation.goBack();
};
```

#### `getPatientProfile()`
Obtiene el perfil completo del paciente autenticado.

#### `getExerciseHistory(limit = 10)`
Obtiene el historial de ejercicios del paciente.

## 📱 Flujo de Usuario

1. **Login** → Usuario ingresa email/password
2. **MainScreen** → Menú principal
3. **VideoRefScreen** → 
   - Carga ejercicios asignados desde Supabase
   - Muestra: "Hola, [nombre del paciente]"
   - Lista ejercicios con nombre y patología
   - Si no hay asignados, muestra lista estática
4. **Realizar ejercicio** → Evaluación en tiempo real
5. **Finalizar** → Guardar sesión en `exercise_history`
6. **HistorialScreen** → Ver progreso
7. **PerfilScreen** → Editar datos personales

## 🔄 Sincronización con App Web

La app móvil ahora comparte la misma base de datos con la app web:

- **Terapeutas** (web) asignan ejercicios → aparecen en app móvil
- **Pacientes** (móvil) completan ejercicios → aparecen en reportes web
- **Perfiles** sincronizados entre ambas plataformas
- **Historial** visible desde web y móvil

## 🚀 Próximos Pasos (Pendientes)

1. **Integrar guardado automático de sesiones** en VideoRefScreen
   - Agregar botón "Finalizar sesión"
   - Llamar `saveExerciseSession()` con estadísticas
   - Confirmar guardado exitoso

2. **Manejo de sesiones offline**
   - Guardar localmente si no hay conexión
   - Sincronizar cuando vuelva internet

3. **Notificaciones**
   - Recordatorios de ejercicios pendientes
   - Mensajes del terapeuta

## 📝 Notas Importantes

- La columna `user_id` fue agregada manualmente a la tabla `patients`
- Los ejercicios se cargan desde `assigned_exercises` con join a `exercises` y `pathologies`
- Si el usuario no está autenticado, la app usa datos de ejemplo
- El video_url debe apuntar al servidor backend o a Supabase Storage
