Obsoleto. Ver DOCUMENTACION_UNICA.md

## ✅ Estado del Sistema

El sistema está **100% operativo** con integración completa de Supabase. Todos los datos se guardan en la base de datos real, no en localStorage.

## 📋 Estructura Implementada

### 1. Módulos de Supabase
- ✅ `supabase-client.js` - Inicialización de clientes (anon + service role)
- ✅ `supabase-auth.js` - Autenticación y gestión de usuarios
- ✅ `supabase-patients.js` - Operaciones CRUD para pacientes
- ✅ `supabase-therapists.js` - Operaciones CRUD para terapeutas
- ✅ `supabase-exercises.js` - Gestión de ejercicios
- ✅ `supabase-history.js` - Historial y seguimiento

### 2. Formularios de Registro

#### 👥 Dar de Alta Paciente
- **Ubicación**: `/Administrador/Dar de alta paciente/alta-paciente.html`
- **Archivo Supabase**: `alta-paciente-supabase.js`
- **Campos**: Nombre, Edad, Teléfono, Email, Contraseña, Diagnóstico, Terapeuta, Foto
- **Funcionalidad**: Crea usuario en Auth + registro en tabla `patients`
- **Redirección**: A `/Administrador/Pacientes/pacientes.html` tras éxito

#### 👨‍⚕️ Dar de Alta Terapeuta
- **Ubicación**: `/Administrador/Dar de alta terapeuta/alta-terapeuta.html`
- **Archivo Supabase**: `alta-terapeuta-supabase.js`
- **Campos**: Nombre, Especialidad, Teléfono, Email, Contraseña, Número de Licencia, Foto
- **Funcionalidad**: Crea usuario en Auth + registro en tabla `therapists`
- **Redirección**: A `/Administrador/terapeuta/terapeutas.html` tras éxito

#### ⚙️ Dar de Alta Administrador
- **Ubicación**: `/Administrador/Dar de alta admin/alta-admin.html`
- **Archivo Supabase**: `alta-admin-supabase.js`
- **Campos**: Nombre, Email, Contraseña, Teléfono, Departamento, Foto
- **Funcionalidad**: Crea usuario en Auth + asigna rol `admin`
- **Redirección**: A `/Administrador/Dashboard/dashboard-admin.html` tras éxito
- **Protección**: Requiere ser admin para acceder

### 3. Base de Datos

#### Tablas Creadas
- `users` - Perfiles de usuario (admin, therapist, patient)
- `therapists` - Datos de terapeutas
- `patients` - Datos de pacientes
- `exercises` - Catálogo de ejercicios
- `patient_exercises` - Asignación de ejercicios a pacientes
- `history` - Historial de sesiones
- `progress_logs` - Registros de progreso
- `notifications` - Notificaciones del sistema

#### RLS (Row Level Security)
- Todos los datos están protegidos por RLS
- Service Role Key usado para operaciones de admin que requieren bypass de RLS
- Anon Client para operaciones de usuario regular

## 🚀 Cómo Usar

### 1. Ver Estado del Sistema
Abre `SISTEMA_REGISTRO.html` para ver:
- ✅ Usuarios registrados
- ✅ Pacientes registrados
- ✅ Terapeutas registrados
- 📊 Dashboard en tiempo real

### 2. Registrar Paciente
1. Ve a `/Administrador/Dar de alta paciente/alta-paciente.html`
2. Completa el formulario:
   - Nombre del paciente
   - Edad
   - Teléfono
   - Email (será el usuario para acceso)
   - Contraseña
   - Diagnóstico
   - Terapeuta asignado
3. Click en "Guardar paciente"
4. Éxito ✅ - El paciente puede ahora iniciar sesión

### 3. Registrar Terapeuta
1. Ve a `/Administrador/Dar de alta terapeuta/alta-terapeuta.html`
2. Completa el formulario:
   - Nombre completo
   - Especialidad
   - Email
   - Contraseña
   - Teléfono
   - Número de licencia
3. Click en "Registrar Terapeuta"
4. Éxito ✅ - El terapeuta puede ahora iniciar sesión

### 4. Registrar Administrador
1. Ve a `/Administrador/Dar de alta admin/alta-admin.html`
2. Completa el formulario (solo admin puede acceder)
3. Click en "Crear Administrador"
4. Éxito ✅ - El nuevo admin puede acceder al panel

## 📝 Datos Guardados

### Paciente
```json
{
  "user_id": "uuid",
  "full_name": "Juan Pérez",
  "age": 35,
  "phone": "555-123-4567",
  "email": "juan@ejemplo.com",
  "status": "Activo",
  "diagnosis": "Espondilólisis",
  "assigned_therapist_id": "uuid",
  "notes": "Resumen clínico",
  "avatar_url": "data:image/...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Terapeuta
```json
{
  "user_id": "uuid",
  "full_name": "Dr. María García",
  "specialty": "Fisioterapia general",
  "phone": "555-987-6543",
  "email": "maria@ejemplo.com",
  "license_number": "FIS-12345",
  "avatar_url": "data:image/...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Administrador
```json
{
  "id": "uuid",
  "email": "admin@ejemplo.com",
  "role": "admin",
  "full_name": "Administrador General",
  "phone": "555-111-2222",
  "created_at": "2024-01-15T10:30:00Z"
}
```

## 🔐 Seguridad

### Autenticación
- ✅ Supabase Auth con JWT tokens
- ✅ Email + Contraseña verificados
- ✅ Sesiones persistentes

### Autorización
- ✅ RLS en todas las tablas
- ✅ Service Role Key solo en backend
- ✅ Validación de rol en operaciones críticas
- ✅ Admin check en formulario de admin

### Datos
- ✅ Encriptados en reposo (Supabase)
- ✅ HTTPS en tránsito
- ✅ Backups automáticos

## 📊 Dashboard de Monitoreo

**Ubicación**: `SISTEMA_REGISTRO.html`

Muestra en tiempo real:
- Número total de usuarios
- Roles asignados
- Pacientes registrados
- Terapeutas activos
- Fechas de registro

Funciones:
- 🔄 Actualizar datos
- 📋 Ver detalles en tablas
- 🔗 Acceso directo a formularios

## ⚠️ Notas Importantes

1. **Contraseñas**: Mínimo 6 caracteres
2. **Email**: Debe ser único y válido
3. **Fotos**: Se guardan como base64 en la base de datos
4. **Validación**: Los campos requeridos están marcados con *
5. **Redirecciones**: Automáticas tras registro exitoso

## 🔧 Troubleshooting

### "Error: Supabase no disponible"
- Verifica que los scripts `supabase-client.js` y `supabase-auth.js` estén cargados
- Revisa la consola del navegador (F12)

### "Error al crear usuario"
- Verifica que el email sea único
- Asegúrate que la contraseña tenga al menos 6 caracteres
- Revisa que los campos requeridos estén completos

### "No puedo ver los datos guardados"
- Abre `SISTEMA_REGISTRO.html` para verificar
- Click en "Actualizar Datos"
- Revisa que el navegador no tenga bloqueadas las cookies

### "Error de acceso a admin"
- Solo usuarios con rol `admin` pueden acceder a crear admins
- Inicia sesión primero con un admin existente

## 📱 Próximas Mejoras

- [ ] Edición de perfiles
- [ ] Eliminación lógica de usuarios
- [ ] Exportación de datos
- [ ] Reportes avanzados
- [ ] Notificaciones en tiempo real
- [ ] Integración de pagos

## 📞 Soporte

Para problemas:
1. Abre la consola del navegador (F12)
2. Revisa los logs de error
3. Verifica la conexión a Supabase
4. Consulta la tabla de datos en `SISTEMA_REGISTRO.html`

---

**Sistema creado con ❤️ integrado a Supabase**
