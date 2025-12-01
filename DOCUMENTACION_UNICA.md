# 📘 Documentación Unificada del Sistema de Terapia

Esta única referencia reemplaza múltiples archivos de indicaciones y resúmenes. Contiene: Quick Start, Configuración Supabase, Arquitectura, Flujo de Registro, Políticas RLS, SQL base y Referencia Rápida.

---
## 🚀 Quick Start (Resumen)
1. Crear proyecto en Supabase y obtener `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
2. Editar `front-end/shared/supabase-client.js` con tus credenciales.
3. Ejecutar el SQL mínimo de tablas (ver sección SQL).
4. Abrir `DIAGNOSTICO_SUPABASE.html` para verificar conexión.
5. Registrar usuarios desde páginas de alta (admin / terapeuta / paciente).

Comprobación rápida en consola del navegador:
```javascript
window.SupabaseConfig && window.SupabaseConfig.isConfigured()
```
Debe devolver `true` si está correctamente configurado.

---
## 🏗 Arquitectura (Vista Simplificada)
Frontend (HTML + JS) → Módulos (`supabase-auth`, `supabase-patients`, etc.) → Cliente Supabase → Servicios (Auth / Postgres / Storage / RLS).

Tablas principales: `users`, `patients`, `therapists`, `pathologies`, `exercises`, `exercise_history`.

---
## 🔐 Flujo de Autenticación
1. Usuario envía email/contraseña.
2. `SupabaseAuth.signIn` / `signUp` crea o valida sesión.
3. Se obtiene perfil y rol.
4. Se guarda sesión (`auth_user`, `auth_session`).
5. Redirección según rol (admin / therapist / patient).

---
## 👥 Flujo de Registro Paciente
Formulario → Validación → `SupabaseAuth.signUp(role='patient')` → Inserción en `patients` (sin `user_id` si columna no existe) → Éxito y redirección.

Terapeuta: Igual pero rol `therapist` y tabla `therapists` (puede incluir `user_id` si el esquema lo tiene).

Admin: Rol `admin` y privilegios ampliados.

---
## 📊 Estado de Esquema Actual (Detectado)
Según diagnósticos recientes las columnas existentes en producción difieren del diseño ideal. Ajusta los scripts para NO enviar campos inexistentes (`user_id` en patients, `date_of_birth`, `medical_history`, etc.). Usa `DIAGNOSTICO_ESQUEMA.html` para verificar cuando cambies el esquema.

---
## 🛡 RLS (Row Level Security) - Recomendaciones
Durante pruebas puedes desactivar o flexibilizar políticas. Para entorno real:
- Limita SELECT por rol.
- Permite UPDATE solo al dueño (auth.uid()).
- Usa client de servicio únicamente en operaciones internas seguras.

Ejemplo temporal para permitir todo (no usar en producción prolongada):
```sql
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
-- O crear políticas amplias:
CREATE POLICY "All select" ON patients FOR SELECT USING (true);
```

---
## 🗄 SQL Base (Diseño Objetivo Simplificado)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin','therapist','patient')) DEFAULT 'patient',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  specialization TEXT,
  professional_license TEXT,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Si agregas columnas nuevas, actualiza los scripts de registro para reflejarlo.

---
## 📦 Referencia de Módulos
`supabase-client.js`: Inicializa clientes (anon + service role).  
`supabase-auth.js`: SignUp, SignIn, Session, Perfil, Roles.  
`supabase-patients.js`: Operaciones de lectura/escritura pacientes (ajusta campos existentes).  
`supabase-therapists.js`: CRUD terapeutas.  
`supabase-exercises.js`: Ejercicios y patologías.  
`supabase-history.js`: Historial de ejercicios realizados.

---
## 💻 Ejemplos Rápidos
Login:
```javascript
const r = await SupabaseAuth.signIn(email, password);
if(r.success) console.log(r.user);
```
Crear paciente (si ya existe email, intentar update):
```javascript
await supabaseServiceClient.from('patients')
  .insert([{ first_name:'Ana', last_name:'Lopez', email:'ana@ejemplo.com' }]);
```
Listar terapeutas:
```javascript
const { data } = await supabaseClient.from('therapists').select('*');
```

---
## 🧪 Diagnóstico y Tests
`DIAGNOSTICO_SUPABASE.html`: Verifica conexión y usuarios.  
`DIAGNOSTICO_ESQUEMA.html`: Inspecciona columnas reales.  
`TEST_SISTEMA.html`: Ejecuta flujo de pruebas integrales.  

---
## 🧹 Limpieza y Mantenimiento
1. Mantén solo este archivo como fuente de verdad documental.
2. Actualiza secciones cuando cambie el esquema o flujo.
3. Usa comentarios breves en código en vez de múltiples README duplicados.

---
## ❓ FAQ Breve
**Error columna no existe**: Ajusta payload en JS para coincidir con columnas reales.  
**RLS bloquea inserciones**: Verifica políticas o desactiva temporal en pruebas.  
**Sesión perdida**: Revisa expiración y `SupabaseAuth.getSession()`.  
**Videos no cargan**: Confirma rutas y bucket de storage configurado.

---
## 🗂 Historial de Consolidación
Archivos fusionados aquí: QUICKSTART.md, README_SUPABASE.md, SUPABASE_SETUP_GUIDE.md, RESUMEN_IMPLEMENTACION.txt, ARCHITECTURE.md y otros duplicados de inicio/índice.

Última actualización: {{TIMESTAMP}}
