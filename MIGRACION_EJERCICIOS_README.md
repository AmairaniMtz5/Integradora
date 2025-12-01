# Migración de Ejercicios a Supabase

## Resumen de Cambios

Este proyecto ha sido actualizado para almacenar los **ejercicios predeterminados** en **Supabase** en lugar de `localStorage`. Esto permite que los ejercicios estén disponibles para todos los usuarios (administradores y terapeutas) sin necesidad de configuración local.

---

## 📋 Pasos para Implementar

### 1. Actualizar la Tabla `exercises` en Supabase

Ejecuta el siguiente script SQL en el **SQL Editor de Supabase**:

```bash
# Archivo: UPDATE_EXERCISES_TABLE.sql
```

Este script:
- Agrega columnas necesarias (`video_id`, `icon`, `meta`, `media_ref`, `media_name`)
- Crea índices para optimizar búsquedas
- Configura políticas RLS (Row Level Security) para:
  - **Lectura**: Todos los usuarios autenticados
  - **Escritura**: Solo administradores

---

### 2. Inicializar Ejercicios desde Videos Bundled

Tienes **dos opciones** para poblar la base de datos con ejercicios:

#### **Opción A: Desde la Consola del Navegador (Recomendado)**

1. Inicia sesión como **Administrador**
2. Abre las **DevTools** del navegador (F12)
3. Ve a la pestaña **Console**
4. Copia y pega el contenido completo del archivo:
   ```
   scripts/init-exercises-to-supabase.js
   ```
5. Presiona **Enter**

El script automáticamente:
- Carga los 29 videos bundled desde `Administrador/Ejercicios/videos/`
- Los agrupa por patología
- Los inserta en Supabase
- Muestra un resumen al finalizar

#### **Opción B: Visitar las Páginas de Patología**

1. Inicia sesión como **Administrador**
2. Ve a **Ejercicios** → Click en cada patología:
   - Escoliosis lumbar
   - Espondilólisis
   - Hernia de disco lumbar
   - Lumbalgia mecánica inespecífica

Cuando entras a cada página, el sistema auto-crea los ejercicios desde los videos bundled **automáticamente** (si no existen).

---

### 3. Verificar la Migración

#### En Supabase Dashboard:
1. Ve a **Table Editor** → Tabla `exercises`
2. Deberías ver ~29 registros con:
   - `video_id`: ID del video (ej: `"ambas-rodillas-al-pecho"`)
   - `name`: Nombre descriptivo
   - `pathology`: `"escoliosis"`, `"hernia"`, `"lumbalgia"`, `"espondilolisis"`
   - `video_url`: Ruta al video bundled

#### En la Aplicación:
1. **Como Terapeuta**: Ve a "Centro de Ejercicios"
   - Deberías ver los ejercicios agrupados por patología
   - La consola debe mostrar:
     ```
     [ejercicios] Ejercicios cargados desde Supabase: 4 patologías
     [ejercicios] Total ejercicios: 29
     ```

2. **Como Administrador**: Ve a "Ejercicios" → Click en una patología
   - Deberías ver la lista de ejercicios con videos
   - Los ejercicios ahora se guardan en Supabase automáticamente

---

## 🔧 Archivos Modificados

### Nuevos Archivos:
- `UPDATE_EXERCISES_TABLE.sql` - Script SQL para actualizar la tabla
- `scripts/init-exercises-to-supabase.js` - Script de inicialización
- `MIGRACION_EJERCICIOS_README.md` - Esta guía

### Archivos Actualizados:
1. **`front-end/Administrador/Ejercicios/patologia.js`**
   - `readDefaults()` → Ahora lee desde Supabase (async)
   - `saveExerciseObj()` → Guarda en Supabase (INSERT/UPDATE)
   - `deleteExercise()` → Elimina de Supabase
   - `ensureDefaultExercisesFromVideos()` → Auto-crea en Supabase

2. **`front-end/Terapeuta/Ejercicios/ejercicios.js`**
   - `loadDefaultExercises()` → Carga desde Supabase
   - `refreshCache()` → Ahora es async

3. **`front-end/Terapeuta/Pacientes/perfil-paciente.js`**
   - `getExerciseDetails()` → Lee desde `window.__defaultExercises`
   - `ensureExercisesLoaded()` → Carga automática desde Supabase

4. **`front-end/Administrador/ver perfil/ver_perfil.js`**
   - `readDefaults()` → Prioriza `window.__defaultExercises`
   - `loadExercisesFromSupabase()` → Nueva función de carga

---

## 🚀 Beneficios de Esta Migración

1. **Centralización**: Un solo lugar para todos los ejercicios
2. **Consistencia**: Todos los usuarios ven los mismos ejercicios
3. **Escalabilidad**: Fácil agregar/modificar ejercicios desde cualquier dispositivo
4. **Sincronización**: Cambios se reflejan inmediatamente para todos
5. **Backup**: Los ejercicios están respaldados en Supabase
6. **No más localStorage**: Elimina problemas de cuota y sincronización

---

## 🐛 Solución de Problemas

### Los ejercicios no aparecen para el terapeuta

**Causa**: La tabla `exercises` está vacía

**Solución**: Ejecuta el script de inicialización (Paso 2)

### Error: "No se encontró cliente Supabase"

**Causa**: Los scripts de Supabase no se cargaron

**Solución**: Verifica que estas líneas estén en el HTML:
```html
<script src="../../shared/supabase-client.js"></script>
```

### Los ejercicios se duplican

**Causa**: Se ejecutó el script de inicialización múltiples veces

**Solución**: El script verifica duplicados por `video_id + pathology`, no debería duplicar. Si lo hace:
1. Ve a Supabase → Table Editor → `exercises`
2. Elimina los duplicados manualmente
3. Ejecuta el script de nuevo

### Quiero volver a localStorage

**Causa**: Problemas con la migración

**Solución**: 
1. Revierte los cambios en Git
2. O modifica las funciones para leer de `localStorage.getItem('default_exercises')`

---

## 📝 Notas Técnicas

### Formato de Datos

**Supabase (`exercises` table)**:
```json
{
  "id": "uuid-generado",
  "video_id": "ambas-rodillas-al-pecho",
  "name": "Ambas rodillas al pecho",
  "description": "Ejercicio para flexibilidad lumbar",
  "pathology": "lumbalgia",
  "video_url": "../Administrador/Ejercicios/videos/Lumbalgia mecánica inespecífica/ambas-rodillas-al-pecho.mp4",
  "icon": "⚡",
  "meta": "",
  "media_ref": {"type": "bundled", "id": "ambas-rodillas-al-pecho"},
  "media_name": "Ambas rodillas al pecho"
}
```

**Caché en Frontend (`window.__defaultExercises`)**:
```javascript
{
  "lumbalgia": [
    {
      "id": "ambas-rodillas-al-pecho",
      "name": "Ambas rodillas al pecho",
      "desc": "Ejercicio para flexibilidad lumbar",
      "icon": "⚡",
      "media": "../Administrador/Ejercicios/videos/...",
      "mediaRef": {"type": "bundled", "id": "..."},
      "pathology": "lumbalgia"
    }
  ],
  "escoliosis": [...],
  "hernia": [...],
  "espondilolisis": [...]
}
```

---

## ✅ Checklist de Migración

- [ ] Ejecutar `UPDATE_EXERCISES_TABLE.sql` en Supabase
- [ ] Ejecutar script de inicialización (Opción A o B)
- [ ] Verificar ejercicios en Supabase Table Editor
- [ ] Probar como Terapeuta: "Centro de Ejercicios"
- [ ] Probar como Admin: Crear/editar ejercicios
- [ ] Verificar videos se muestran correctamente
- [ ] Limpiar `localStorage` (opcional): `localStorage.removeItem('default_exercises')`

---

## 🎯 Próximos Pasos (Futuro)

1. Migrar `assigned_exercises` a Supabase (actualmente en localStorage)
2. Migrar `therapist_patients` a relación directa en tabla `patients`
3. Implementar versionado de ejercicios
4. Agregar tags/categorías a ejercicios
5. Sistema de favoritos para terapeutas

---

¿Necesitas ayuda? Revisa los logs de la consola - cada función imprime mensajes de debug con `[nombre-archivo]` para facilitar troubleshooting.
