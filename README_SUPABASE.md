Obsoleto. Ver DOCUMENTACION_UNICA.md

## 📚 Documentación de Integración

Este proyecto ha sido integrado completamente con **Supabase** como backend y base de datos. A continuación encontrarás toda la información necesaria para empezar.

---

## 🚀 Quick Start (5 minutos)

### 1. Crear cuenta en Supabase
- Visita [https://supabase.com](https://supabase.com)
- Crea un nuevo proyecto
- Copia las credenciales (URL y API Key)

### 2. Configurar credenciales
Abre `front-end/shared/supabase-client.js` y reemplaza:
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### 3. Crear tablas
Copia el SQL de `SUPABASE_SETUP_GUIDE.md` en el SQL Editor de Supabase

### 4. Incluir scripts en HTML
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/shared/supabase-client.js"></script>
<script src="/shared/supabase-auth.js"></script>
<script src="/shared/supabase-patients.js"></script>
<script src="/shared/supabase-therapists.js"></script>
<script src="/shared/supabase-exercises.js"></script>
<script src="/shared/supabase-history.js"></script>
```

### 5. Listo! 🎉
Ahora puedes usar los módulos de Supabase en tu código.

---

## 📂 Archivos Incluidos

### Documentación
| Archivo | Descripción |
|---------|------------|
| `SUPABASE_SETUP_GUIDE.md` | Guía completa de instalación y configuración |
| `SUPABASE_EXAMPLES.md` | Ejemplos de código para cada módulo |
| `SUPABASE_TEST_TEMPLATE.html` | Página HTML interactiva para probar funciones |

### Módulos JavaScript
| Archivo | Función |
|---------|---------|
| `front-end/shared/supabase-client.js` | Inicializa la conexión a Supabase |
| `front-end/shared/supabase-auth.js` | Autenticación de usuarios |
| `front-end/shared/supabase-patients.js` | CRUD de pacientes |
| `front-end/shared/supabase-therapists.js` | CRUD de terapeutas |
| `front-end/shared/supabase-exercises.js` | CRUD de ejercicios y patologías |
| `front-end/shared/supabase-history.js` | Historial y estadísticas |

---

## 🔐 Seguridad

Todos los módulos incluyen:
- ✅ **Row Level Security (RLS)**: Los usuarios solo acceden a sus datos
- ✅ **Validación de entrada**: Se validan todos los datos antes de enviar
- ✅ **Manejo de errores**: Respuestas consistentes con códigos de error
- ✅ **JWT tokens**: Autenticación segura con Supabase

---

## 📊 Base de Datos

### Tablas principales

```
users
├── id (UUID)
├── email
├── full_name
├── role (admin, therapist, patient)
├── clinic
└── ...

patients
├── id (UUID)
├── first_name
├── last_name
├── email
├── therapist_id (FK to users)
└── ...

therapists
├── id (UUID)
├── first_name
├── last_name
├── email
├── user_id (FK to users)
└── ...

pathologies
├── id (UUID)
├── name
└── description

exercises
├── id (UUID)
├── name
├── pathology_id (FK to pathologies)
├── video_url
└── ...

exercise_history
├── id (UUID)
├── patient_id (FK to patients)
├── exercise_id (FK to exercises)
├── date_performed
├── duration_seconds
└── ...
```

---

## 💻 Uso en tu código

### Ejemplo 1: Login
```javascript
const result = await window.SupabaseAuth.signIn('user@example.com', 'password');
if (result.success) {
  console.log('Usuario autenticado:', result.user);
}
```

### Ejemplo 2: Obtener pacientes
```javascript
const result = await window.SupabasePatients.getPatients();
result.data.forEach(patient => {
  console.log(patient.first_name);
});
```

### Ejemplo 3: Crear ejercicio
```javascript
const result = await window.SupabaseExercises.createExercise({
  name: 'Flexión de cadera',
  pathologyId: 'uuid-xxx',
  durationMinutes: 10
});
```

### Ejemplo 4: Registrar historial
```javascript
await window.SupabaseHistory.createHistory({
  patientId: 'uuid-xxx',
  exerciseId: 'uuid-xxx',
  durationSeconds: 300,
  repetitions: 15,
  status: 'completed'
});
```

---

## 🧪 Pruebas

### Opción 1: Usar la página de pruebas
1. Abre `SUPABASE_TEST_TEMPLATE.html` en tu navegador
2. Prueba todas las funciones desde la interfaz interactiva

### Opción 2: Consola del navegador
```javascript
// Verificar configuración
console.log(window.SupabaseConfig.isConfigured()); // true/false

// Probar conexión
const result = await window.SupabaseAuth.getCurrentUser();
console.log(result);
```

---

## 🛠️ Integración con código existente

### Reemplazar localStorage con Supabase

**Antes:**
```javascript
const user = JSON.parse(localStorage.getItem('user'));
```

**Después:**
```javascript
const user = await window.SupabaseAuth.getCurrentUser();
```

### Integrar en login.js

```javascript
// En front-end/Administrador/login/login.js
const result = await window.SupabaseAuth.signIn(email, password);
if (result.success) {
  // Redirigir según rol
  window.location.href = result.profile.role === 'therapist' 
    ? '/Terapeuta/Dashboard/dashboardt.html'
    : '/Administrador/Dashboard/dashboard-admin.html';
}
```

---

## 📱 Estructura de datos retornada

Todos los módulos retornan objetos con esta estructura:

```javascript
{
  success: true,        // boolean
  data: [...],          // datos o null
  error: "mensaje"      // solo si success === false
}
```

---

## 🔄 Roles y permisos

### Admin
- Acceso a todos los usuarios
- Gestión de terapeutas
- Gestión de pacientes
- Acceso a reportes globales

### Therapist (Terapeuta)
- Ver pacientes asignados
- Crear y editar ejercicios
- Ver historial de pacientes
- Generar reportes de pacientes

### Patient (Paciente)
- Ver ejercicios asignados
- Registrar ejercicios completados
- Ver su historial
- Ver sus reportes

---

## 🚨 Troubleshooting

### Error: "Supabase library not loaded"
→ Asegúrate de incluir el script de CDN antes de los módulos

### Error: "Invalid API key"
→ Verifica que copiaste correctamente las credenciales

### Error: "CORS policy"
→ Configura URLs de redirección en Supabase Settings

### No aparecen datos
→ Verifica que las políticas RLS permitan el acceso

---

## 📚 Recursos

| Recurso | Link |
|---------|------|
| Documentación oficial | [https://supabase.com/docs](https://supabase.com/docs) |
| Ejemplos | [https://github.com/supabase/supabase](https://github.com/supabase/supabase) |
| Comunidad | [https://discord.supabase.com](https://discord.supabase.com) |

---

## 🎯 Checklist de implementación

- [x] Módulos de Supabase creados
- [x] Documentación completa
- [x] Ejemplos de código
- [x] Página de pruebas
- [ ] Credenciales configuradas
- [ ] Tablas creadas en BD
- [ ] Integración en login
- [ ] Pruebas completadas
- [ ] Despliegue en producción

---

## 📞 Soporte

Si tienes problemas:
1. Revisa `SUPABASE_SETUP_GUIDE.md`
2. Consulta `SUPABASE_EXAMPLES.md`
3. Abre la consola (F12) para ver errores
4. Visita la documentación oficial de Supabase

---

## 📝 Notas importantes

⚠️ **Seguridad:**
- Nunca compartas tus credenciales de Supabase
- Usa variables de entorno en producción
- Revisa las políticas RLS regularmente

💡 **Desarrollo:**
- Comienza con la página de pruebas para entender los módulos
- Integra gradualmente en tu código existente
- Prueba cada función antes de usarla en producción

🚀 **Escalabilidad:**
- Supabase escala automáticamente
- Los almacenamientos de archivos están en Supabase Storage
- Las APIs son ilimitadas

---

**¡Tu aplicación está lista para usar Supabase! 🎉**

Última actualización: Noviembre 2024
