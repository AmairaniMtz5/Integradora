# 🚀 Guía: Crear Usuarios de Prueba

## ¿Por qué crear usuarios de prueba?

Antes de poder login en tu aplicación, necesitas usuarios registrados en Supabase con sus respectivos roles.

## Paso 1: Abrir la página de creación

1. Abre tu navegador
2. Ve a: `http://localhost:8000/CREAR_USUARIOS_PRUEBA.html`

## Paso 2: Crear usuarios preestablecidos (RECOMENDADO)

La forma más fácil es hacer clic en los botones de usuario preestablecido:

### 📊 Botón "Admin"
Crea un usuario administrador:
- **Email:** `admin@integradora.com`
- **Contraseña:** `Admin123!`
- **Rol:** Admin
- **Clínica:** Clínica Principal

### 🏥 Botón "Terapeuta"
Crea un usuario terapeuta:
- **Email:** `terapeuta@integradora.com`
- **Contraseña:** `Terapeuta123!`
- **Rol:** Therapist
- **Clínica:** Clínica Principal

### 👤 Botón "Paciente"
Crea un usuario paciente:
- **Email:** `paciente@integradora.com`
- **Contraseña:** `Paciente123!`
- **Rol:** Patient
- **Clínica:** Clínica Principal

### ✨ Botón "Crear Todos"
Crea los tres usuarios automáticamente.

## Paso 3: Verificar creación

1. La página mostrará ✅ cuando se creen correctamente
2. Verás una lista con los datos de cada usuario
3. Haz clic en **"Copiar todas las credenciales"** para guardarlas

## Paso 4: Testear Login

### ✅ Con el Admin:
1. Ve a: `http://localhost:8000/Administrador/login/index.html`
2. Selecciona: **Administrador**
3. Email: `admin@integradora.com`
4. Contraseña: `Admin123!`
5. Haz clic en **Log in**

### ✅ Con el Terapeuta:
1. Ve a: `http://localhost:8000/Administrador/login/index.html`
2. Selecciona: **Terapeuta**
3. Email: `terapeuta@integradora.com`
4. Contraseña: `Terapeuta123!`
5. Haz clic en **Log in**

## 🛠️ Crear usuarios personalizados

Si quieres crear usuarios adicionales:

1. Rellena los campos:
   - Email
   - Contraseña (mín. 6 caracteres)
   - Nombre Completo
   - Rol (Admin / Terapeuta / Paciente)
   - Clínica
   - Teléfono

2. Haz clic en **"Crear Usuario"**

3. Las credenciales aparecerán en la lista de abajo

## 🚨 Errores comunes

### ❌ "Email ya existe"
→ Ya creaste un usuario con ese email. Usa otro o elimínalo en Supabase.

### ❌ "Supabase no está configurado"
→ Las credenciales de Supabase en `supabase-client.js` están mal.
→ Verifica que copiaste correctamente la URL y la anon key.

### ❌ Login dice "Credenciales inválidas"
→ Usa exactamente el email y contraseña que creaste.
→ Verifica que seleccionaste el rol correcto.

## ✅ Checklist

- [ ] Abrí `CREAR_USUARIOS_PRUEBA.html`
- [ ] Creé al menos 1 usuario (admin, terapeuta o paciente)
- [ ] Copié las credenciales
- [ ] Logué con éxito en el login
- [ ] Fui redirigido al dashboard correcto

¡Listo! 🎉 Tu sistema de autenticación con Supabase está funcionando.
