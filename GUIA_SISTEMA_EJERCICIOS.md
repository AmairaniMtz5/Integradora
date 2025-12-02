# 🎯 GUÍA COMPLETA: Sistema de Asignación de Ejercicios (Admin → Terapeuta → Paciente)

## 📋 Resumen del Sistema

Este sistema permite que el **Administrador** asigne ejercicios a pacientes, el **Terapeuta** los revise y apruebe, y finalmente aparezcan en la **App Móvil** del paciente.

---

## 🔄 Flujo Completo

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│Administrador│ ───> │admin_assigned│ ───> │  Terapeuta  │ ───> │assigned_     │
│  asigna     │      │  _exercises  │      │   aprueba   │      │ exercises    │
│ ejercicio   │      │(status:      │      │             │      │              │
│             │      │ pending)     │      │             │      │              │
└─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
                                                                        │
                                                                        ▼
                                                              ┌──────────────────┐
                                                              │   App Móvil      │
                                                              │   (Imitar)       │
                                                              │  Muestra solo    │
                                                              │  ejercicios      │
                                                              │  aprobados       │
                                                              └──────────────────┘
```

---

## 🗄️ Paso 1: Crear la Base de Datos

### Ejecutar en Supabase SQL Editor:

**Archivo:** `CREAR_ADMIN_ASSIGNED_EXERCISES.sql`

Este script crea:

1. **Tabla `admin_assigned_exercises`**
   - `patient_id`: Paciente al que se asigna
   - `exercise_id`: Ejercicio asignado
   - `admin_id`: Administrador que asignó
   - `status`: `pending`, `approved`, `rejected`
   - `notes`: Notas del administrador

2. **Políticas RLS:**
   - Admins pueden insertar
   - Terapeutas ven ejercicios de SUS pacientes
   - Terapeutas pueden actualizar status

3. **Función `approve_admin_exercise()`:**
   - Mueve ejercicio de `admin_assigned_exercises` → `assigned_exercises`
   - Cambia status a `approved`

### ✅ Verificar:
```sql
SELECT * FROM admin_assigned_exercises LIMIT 5;
```

---

## 💻 Paso 2: Código del Administrador

### Archivo Modificado: `front-end/Administrador/Ejercicios/patologia.js`

**Función `assignExerciseToTherapist()` actualizada:**

```javascript
// ANTES: Insertaba directamente en assigned_exercises
await client.from('assigned_exercises').insert(payload);

// AHORA: Inserta en admin_assigned_exercises con status pending
await client.from('admin_assigned_exercises').insert({
  patient_id: record.patientId,
  exercise_id: record.exerciseId,
  admin_id: user.id,
  pathology: titleMap[pathologyKey] || pathologyKey,
  status: 'pending',
  notes: record.assignmentWeek ? `Semana: ${record.assignmentWeek}` : null
});
```

**Mensaje actualizado:**
```javascript
showToast('Ejercicio asignado (pendiente de aprobación del terapeuta)');
```

### 🧪 Probar:
1. Login como Admin
2. Ir a **Ejercicios → Patologías**
3. Seleccionar terapeuta y paciente
4. Asignar ejercicio
5. Verificar en Supabase: `SELECT * FROM admin_assigned_exercises WHERE status='pending';`

---

## 👨‍⚕️ Paso 3: Interfaz del Terapeuta

### Archivos Creados:

#### 1. `ejercicios-pendientes.html`
- Pantalla para ver ejercicios asignados por el admin
- Filtros por estado (pendientes/aprobados/rechazados)
- Filtros por paciente

#### 2. `ejercicios-pendientes.css`
- Diseño moderno tipo tarjetas
- Badges de colores por estado:
  - 🟡 Naranja: Pendiente
  - 🟢 Verde: Aprobado
  - 🔴 Rojo: Rechazado

#### 3. `ejercicios-pendientes.js`
- Carga ejercicios de `admin_assigned_exercises`
- Función `approveExercise()`: Llama a `approve_admin_exercise()` RPC
- Función `rejectExercise()`: Actualiza status a 'rejected'

### Acceso:
```
Terapeuta Login → Ejercicios → 📋 Ejercicios Pendientes
```

**URL:** `http://localhost:5173/Terapeuta/Ejercicios/ejercicios-pendientes.html`

### 🧪 Probar:
1. Login como Terapeuta
2. Ir a **Ejercicios → Ejercicios Pendientes**
3. Ver ejercicio asignado por admin
4. Hacer clic en **"✓ Aprobar y Asignar"**
5. Verificar en Supabase:
   ```sql
   -- Ejercicio movido a assigned_exercises
   SELECT * FROM assigned_exercises WHERE patient_id = '[UUID_PACIENTE]';
   
   -- Status cambiado a approved
   SELECT * FROM admin_assigned_exercises WHERE status = 'approved';
   ```

---

## 📱 Paso 4: App Móvil (Ya Funciona)

**Archivo:** `app_movil/screens/VideoRefScreen.js`

**Código existente (líneas 116-149):**
```javascript
const { data: assigned, error: assignedError } = await supabase
  .from('assigned_exercises')  // ✅ Lee SOLO de assigned_exercises
  .select(`
    id,
    exercise_id,
    exercises (
      id,
      name,
      video_url,
      pathologies (
        name
      )
    )
  `)
  .eq('patient_id', patient.id);
```

### ✅ No requiere cambios
La app móvil ya está configurada correctamente para mostrar **SOLO** ejercicios de `assigned_exercises`, que son los que el terapeuta aprobó.

---

## 🎨 Interfaz del Terapeuta - Diseño

### Botón en `ejercicios.html`:
```html
<button class="btn-pending" onclick="window.location.href='ejercicios-pendientes.html'">
  📋 Ejercicios Pendientes
</button>
```

### Tarjeta de Ejercicio:
```html
<div class="exercise-card pending">
  <div class="exercise-header">
    <div class="exercise-info">
      <div class="exercise-name">Fortalecimiento lumbar</div>
      <div class="exercise-meta">
        <span>👤 Paciente: Juan Pérez</span>
        <span>🏥 Patología: Lumbalgia</span>
      </div>
    </div>
    <span class="status-badge pending">Pendiente</span>
  </div>
  <div class="exercise-actions">
    <button class="btn-approve">✓ Aprobar y Asignar</button>
    <button class="btn-reject">✗ Rechazar</button>
  </div>
</div>
```

---

## 🧪 Prueba Completa del Sistema

### Test Case Completo:

#### 1. **Como Administrador:**
```
1. Login en http://localhost:5173/Administrador/login/
2. Ir a Ejercicios → Patologías → Escoliosis lumbar
3. Seleccionar:
   - Terapeuta: Dr. López
   - Paciente: María García
   - Video: "Puente.mp4"
4. Click "Asignar ahora"
5. ✅ Ver mensaje: "Ejercicio asignado (pendiente de aprobación)"
```

#### 2. **Como Terapeuta:**
```
1. Login en http://localhost:5173/Terapeuta/login/ (Dr. López)
2. Ir a Ejercicios → 📋 Ejercicios Pendientes
3. ✅ Ver ejercicio "Puente" para María García
4. Click "✓ Aprobar y Asignar"
5. ✅ Ver confirmación: "Ejercicio aprobado y asignado"
6. Verificar que status cambió a "Aprobado"
```

#### 3. **Como Paciente (App Móvil):**
```
1. Login en app móvil (María García)
2. Ir a "Imitar"
3. ✅ Ver "Tus ejercicios asignados"
4. ✅ Ver "Puente.mp4" en la lista
5. Click para ejecutar ejercicio
```

---

## 📊 Verificación en Supabase

### Query 1: Ver ejercicios pendientes
```sql
SELECT 
  ae.id,
  ae.status,
  p.first_name || ' ' || p.last_name as paciente,
  e.name as ejercicio,
  ae.assigned_at
FROM admin_assigned_exercises ae
JOIN patients p ON ae.patient_id = p.id
JOIN exercises e ON ae.exercise_id = e.id
WHERE ae.status = 'pending';
```

### Query 2: Ver ejercicios aprobados
```sql
SELECT 
  a.id,
  p.first_name || ' ' || p.last_name as paciente,
  e.name as ejercicio,
  a.created_at
FROM assigned_exercises a
JOIN patients p ON a.patient_id = p.id
JOIN exercises e ON a.exercise_id = e.id
ORDER BY a.created_at DESC;
```

### Query 3: Historial de aprobaciones
```sql
SELECT 
  ae.id,
  ae.status,
  p.first_name || ' ' || p.last_name as paciente,
  e.name as ejercicio,
  ae.assigned_at,
  ae.notes
FROM admin_assigned_exercises ae
JOIN patients p ON ae.patient_id = p.id
JOIN exercises e ON ae.exercise_id = e.id
WHERE ae.status IN ('approved', 'rejected')
ORDER BY ae.assigned_at DESC;
```

---

## 🔧 Solución de Problemas

### ❌ Ejercicio no aparece en "Pendientes" (Terapeuta)
**Causa:** Terapeuta no tiene asignado ese paciente
**Solución:**
```sql
-- Verificar asignación
SELECT * FROM patients WHERE therapist_id = '[UUID_TERAPEUTA]';

-- Asignar paciente a terapeuta
UPDATE patients 
SET therapist_id = '[UUID_TERAPEUTA]'
WHERE id = '[UUID_PACIENTE]';
```

### ❌ Error al aprobar ejercicio
**Causa:** Función RPC no existe
**Solución:** Ejecutar `CREAR_ADMIN_ASSIGNED_EXERCISES.sql` completo

### ❌ Ejercicio no aparece en app móvil
**Causa:** No se aprobó correctamente
**Solución:** Verificar en `assigned_exercises`:
```sql
SELECT * FROM assigned_exercises WHERE patient_id = '[UUID_PACIENTE]';
```

---

## 📝 Checklist de Implementación

- [ ] **SQL ejecutado en Supabase**
  - [ ] Tabla `admin_assigned_exercises` creada
  - [ ] Función `approve_admin_exercise()` creada
  - [ ] Políticas RLS activas

- [ ] **Código del Administrador**
  - [ ] `patologia.js` actualizado
  - [ ] Mensaje de confirmación correcto
  - [ ] Inserción en `admin_assigned_exercises`

- [ ] **Interfaz del Terapeuta**
  - [ ] `ejercicios-pendientes.html` creado
  - [ ] `ejercicios-pendientes.css` creado
  - [ ] `ejercicios-pendientes.js` creado
  - [ ] Botón en `ejercicios.html` agregado
  - [ ] Estilos de botón en `ejercicios.css`

- [ ] **Pruebas**
  - [ ] Admin puede asignar ejercicios
  - [ ] Terapeuta ve ejercicios pendientes
  - [ ] Terapeuta puede aprobar/rechazar
  - [ ] App móvil muestra solo aprobados

---

## 🎉 Sistema Completo

```
✅ Administrador → Asigna ejercicios → admin_assigned_exercises (pending)
✅ Terapeuta → Revisa en "Ejercicios Pendientes"
✅ Terapeuta → Aprueba → assigned_exercises
✅ App Móvil → Muestra en "Imitar"
```

**¡Todo listo para usar!** 🚀
