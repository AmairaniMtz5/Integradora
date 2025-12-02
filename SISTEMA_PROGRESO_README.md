# Sistema de Registro de Progreso de Ejercicios

## Resumen
Sistema completo para capturar y reportar progreso detallado de ejercicios en la app móvil, con conteo de repeticiones correctas/incorrectas y métricas granulares.

## Componentes Implementados

### 1. Base de Datos (`CREAR_EXERCISE_PROGRESS.sql`)
- **Tabla `exercise_progress`**: Almacena cada sesión individual con:
  - `good_reps`, `bad_reps`: Contador de repeticiones evaluadas por el modelo
  - `target_reps`: Objetivo asignado por el terapeuta
  - `completed`: TRUE si alcanzó el objetivo
  - `duration_seconds`: Duración total de la sesión
  - `therapist_days`, `therapist_week`, `therapist_notes`: Contexto del terapeuta
  - `metrics`: JSON con datos adicionales del servidor (distancias, confianza)
  
- **RLS (Row Level Security)**:
  - Pacientes: leen/insertan solo sus registros
  - Terapeutas: leen registros de pacientes asignados

- **Índices optimizados** para queries de reportes por paciente, fecha y semana

### 2. App Móvil

#### `app_movil/utils/supabaseHelpers.js`
- **`saveExerciseProgress(progress)`**: Helper para insertar sesiones con:
  - Lookup automático de `patient_id` por `auth.uid()`
  - Conversión de timestamps (ms → ISO)
  - Validación y defaults para campos opcionales

#### `app_movil/screens/VideoRefScreen.js`
- **Contador Visual**: Caja flotante en esquina superior izquierda mostrando:
  - ✓ Buenas: N (verde)
  - ✗ Errores: N (rojo)
  - 🚩 Meta: N (amarillo, si definida)

- **Conteo Automático**:
  - Inicializa sesión al seleccionar ejercicio (timestamp, targets, contadores en 0)
  - Durante evaluación: lee `j.is_good` del servidor y con antirrebote (1s) incrementa `goodReps` o `badReps`
  - Lógica de transición: cuenta repetición buena al pasar de "mal" → "bien"; cuenta error al pasar de "bien" → "mal"

- **Guardado al Salir**:
  - Botón "Atrás" en pantalla de grabación llama `handleExitRecording()`
  - Guarda progreso completo: tiempos, reps, objetivos, notas del terapeuta, métricas
  - Vuelve a lista de ejercicios asignados o fallback según flujo

#### `app_movil/screens/HistorialScreen.js`
- **Lectura de `exercise_progress`**: Consulta registros granulares con fallback a `exercise_history`
- **Agrupación por día**: Suma reps totales, errores, completados del día
- **Vista expandible**: Lista de ejercicios realizados en el día con:
  - Nombre, patología
  - ✓ good_reps / ✗ bad_reps / Meta
  - Duración (mm:ss)
  - Checkmark si completado

## Flujo de Usuario

1. **Paciente entra a "Imitar"**:
   - Ve tarjetas de ejercicios asignados por terapeuta (con Repeticiones, Días, Semana, Notas)

2. **Selecciona ejercicio**:
   - Sistema inicializa sesión: timestamp, `targetReps` parseado, contadores en 0
   - Pantalla "recording" muestra contador visual

3. **Durante grabación**:
   - Servidor evalúa frames cada 1.5s y devuelve `is_good: true/false`
   - Con debounce de 1s, incrementa `goodReps` al detectar transición positiva; `badReps` en transición negativa

4. **Al presionar "Atrás"**:
   - Guarda en `exercise_progress`: IDs, nombre, patología, tiempos, duración, reps (buenas/malas/totales), completado, días/semana/notas del terapeuta, métricas
   - Vuelve a lista de ejercicios

5. **Ve "Historial"**:
   - Agrupa sesiones por día
   - Expande para ver detalle de ejercicios: nombre, reps buenas/malas, meta, duración, check de completado

## Pruebas Rápidas

```powershell
# 1. Ejecutar SQL en Supabase (CREAR_EXERCISE_PROGRESS.sql)
# Copia el contenido y ejecuta en SQL Editor

# 2. Probar en app móvil
cd app_movil
npx expo start

# 3. Flujo de prueba:
# - Login como paciente con ejercicios asignados
# - Ir a "Imitar" → seleccionar ejercicio
# - Hacer ~5 reps buenas y 2 malas (observar contador)
# - Presionar "Atrás"
# - Ir a "Historial" → expandir día → verificar detalles
```

## Verificación en Supabase

```sql
-- Ver registros de progreso
SELECT 
  exercise_name,
  good_reps,
  bad_reps,
  target_reps,
  completed,
  duration_seconds,
  started_at
FROM exercise_progress
WHERE patient_id = '<UUID_DEL_PACIENTE>'
ORDER BY started_at DESC
LIMIT 10;

-- Resumen por ejercicio
SELECT 
  exercise_name,
  COUNT(*) as sesiones,
  SUM(good_reps) as total_buenas,
  SUM(bad_reps) as total_malas,
  AVG(duration_seconds) as duracion_promedio
FROM exercise_progress
WHERE patient_id = '<UUID_DEL_PACIENTE>'
GROUP BY exercise_name;
```

## Web de Terapeutas (Pendiente)

Para mostrar estos datos en reportes web del terapeuta:

```javascript
// En front-end/Terapeuta/Reportes/reportes.js

const { data, error } = await supabase
  .from('exercise_progress')
  .select('*')
  .eq('patient_id', patientId)
  .gte('started_at', startDate)
  .lte('started_at', endDate)
  .order('started_at', { ascending: false });

// Renderizar gráficos con Chart.js:
// - Evolución de good_reps vs bad_reps por semana
// - Tasa de completado por ejercicio
// - Adherencia (días con sesiones vs días asignados)
```

## Notas Técnicas

- **Antirrebote**: Cooldown de 1s entre conteos evita doble-conteo por oscilaciones del modelo
- **Refs vs State**: Contadores y timestamps en refs para acceso inmediato sin re-renders; state solo para UI
- **Fallback graceful**: Si no existe `exercise_progress`, intenta leer `exercise_history`; si tampoco, muestra datos de ejemplo
- **Mapeo de IDs**: exercise_id string (`"hernia-el-perro-y-gato"`) → nombre legible y URL de video
- **Completed logic**: `completed = (goodReps >= targetReps)` si hay meta; null si no

## Próximos Pasos

1. ✅ Tabla y RLS creadas
2. ✅ Contador visual en UI móvil
3. ✅ Conteo automático durante grabación
4. ✅ Guardado al salir
5. ✅ Historial móvil lee y muestra progreso
6. ⏳ Reportes web de terapeuta (gráficos, agregaciones semanales)
7. ⏳ Sincronización offline (guardar localmente si sin red; subir después)
8. ⏳ Notificaciones push si paciente no cumple días asignados

---

**Fecha de implementación**: 1 Diciembre 2025  
**Autor**: Sistema de asistencia con IA  
**Estado**: Funcional en móvil; pendiente reportes web
