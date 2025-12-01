Obsoleto. Ver DOCUMENTACION_UNICA.md

## Video Tutorial Escrito: Desde Cero a Funcional en 30 Minutos

---

## 📍 MINUTO 0-5: Crear Proyecto Supabase

### Paso 1: Acceder a Supabase
1. Abre tu navegador
2. Ve a [https://supabase.com](https://supabase.com)
3. Haz clic en "Sign In" (o "Start for free")
4. Elige "Sign in with GitHub" o crea una cuenta

### Paso 2: Crear Nuevo Proyecto
1. En el dashboard, haz clic en "New Project"
2. Rellena:
   - **Name**: `integradora-terapia`
   - **Database Password**: `MiContraseñaFuerte123!@#` (copia en lugar seguro)
   - **Region**: Elige tu país/región
3. Haz clic en "Create new project"
4. **ESPERA 2-3 minutos** hasta que esté listo

### Paso 3: Obtener Credenciales
1. Una vez creado, ve a **Settings** (rueda de engranaje abajo)
2. Haz clic en **API**
3. Busca:
   - **Project URL** → Copia y guarda
   - **anon public key** → Copia y guarda

**Ejemplo (no uses estos valores reales):**
```
URL: https://abc123def456.supabase.co
KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📍 MINUTO 5-10: Configurar el Código

### Paso 4: Actualizar supabase-client.js
1. Abre `front-end/shared/supabase-client.js`
2. Busca estas líneas (arriba del archivo):
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

3. Reemplaza CON TUS VALORES (del Paso 3):
```javascript
const SUPABASE_URL = 'https://abc123def456.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

4. **GUARDA** el archivo (Ctrl+S)

### Paso 5: Verificar Que Se Cargó
1. Abre tu navegador en cualquier carpeta del proyecto
2. Abre la **consola** (F12 → Consola)
3. Escribe:
```javascript
console.log(window.SupabaseConfig.isConfigured());
```

4. Presiona Enter
5. **Debe mostrar: `true`**

Si muestra `false`:
- ❌ Revisa que copiaste bien las credenciales
- ❌ Verifica que el archivo está en `front-end/shared/`
- ❌ Asegúrate de incluir los scripts en el HTML

---

## 📍 MINUTO 10-20: Crear las Tablas

### Paso 6: Abrir SQL Editor
1. Vuelve a Supabase
2. En el menú izquierdo, haz clic en **SQL Editor** (icono ><)
3. Haz clic en **"New Query"**

### Paso 7: Copiar SQL
1. Abre el archivo `SUPABASE_SETUP_GUIDE.md`
2. Busca la sección **"📋 SQL de las tablas"**
3. **COPIA TODO** el código SQL (desde CREATE TABLE hasta el final)

### Paso 8: Ejecutar SQL
1. En Supabase SQL Editor, pega TODO el SQL
2. Haz clic en el botón **"Run"** (esquina superior derecha)
3. **ESPERA** a que termine (no debe haber errores rojos)

**Si ves errores:**
- ❌ Copia nuevamente sin saltos de línea extra
- ❌ Asegúrate de copiar TODO el SQL
- ❌ Si aún hay problemas, copia línea por línea

**Si no hay errores:**
- ✅ Felicidades! Las tablas están creadas
- ✅ En el menú izquierdo, ve a **Tables** para ver las 9 tablas

---

## 📍 MINUTO 20-25: Probar Conexión

### Paso 9: Abrir Página de Pruebas
1. En tu proyecto, localiza `SUPABASE_TEST_TEMPLATE.html`
2. Abre el archivo en tu navegador

### Paso 10: Crear Cuenta de Prueba
1. En la pestaña **🔐 Login**
2. Haz clic en el botón **"Crear Cuenta de Prueba"**
3. Espera a que aparezca el resultado
4. **Guarda el email y password** mostrados

**Ejemplo:**
```
Email: test1732550000000@example.com
Password: TestPassword123!
```

### Paso 11: Probar Login
1. Usa el email y password que te apareció
2. Haz clic en **"Iniciar Sesión"**
3. Debe mostrar: ✅ "Inicio de sesión exitoso"

**Si falla:**
- ❌ Verifica que copias bien las credenciales
- ❌ Abre consola (F12) para ver el error
- ❌ Intenta crear otra cuenta de prueba

---

## 📍 MINUTO 25-30: Cargar Datos de Prueba

### Paso 12: Cargar Ejercicios
1. Abre la consola nuevamente (F12 → Consola)
2. Copia este código:
```javascript
// Copiar el contenido completo de INIT_TEST_DATA.js aquí
```

3. **O simplemente escribe:**
```javascript
initializeTestData();
```

4. Presiona Enter
5. Espera a que veas "✅ INICIALIZACIÓN COMPLETADA"

### Paso 13: Verificar Datos
1. En la página de pruebas, ve a la pestaña **💪 Ejercicios**
2. Haz clic en **"Cargar Patologías"**
3. Debe mostrar 4 patologías (Escoliosis, Espondilólisis, etc.)
4. Haz clic en **"Cargar Todos los Ejercicios"**
5. Deben aparecer 10+ ejercicios

**Si ves los datos:**
- ✅ ¡TODO ESTÁ FUNCIONANDO!
- ✅ Ya puedes integrar en tu código

---

## 🎯 Integración Rápida en Tu Login Actual (5 min extra)

### Paso 14: Incluir Scripts en HTML
Abre tu archivo HTML principal (ej: `index.html` o `dashboard-admin.html`)

Agrega ANTES de tus scripts existentes:
```html
<!-- Supabase JS -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Nuestros módulos -->
<script src="/shared/supabase-client.js"></script>
<script src="/shared/supabase-auth.js"></script>
<script src="/shared/supabase-patients.js"></script>
<script src="/shared/supabase-therapists.js"></script>
<script src="/shared/supabase-exercises.js"></script>
<script src="/shared/supabase-history.js"></script>
```

### Paso 15: Usar en Tu Código
En tu JavaScript, ahora puedes usar:

```javascript
// Login
const result = await window.SupabaseAuth.signIn(email, password);

// Obtener pacientes
const patients = await window.SupabasePatients.getPatients();

// Crear paciente
await window.SupabasePatients.createPatient({...});

// Ver ejercicios
const exercises = await window.SupabaseExercises.getExercises();
```

---

## ✅ Checklist Final

- [ ] Proyecto Supabase creado
- [ ] URL y KEY copiadas
- [ ] `supabase-client.js` actualizado
- [ ] Consola muestra `true`
- [ ] SQL ejecutado sin errores
- [ ] 9 tablas visibles en Supabase
- [ ] Cuenta de prueba creada
- [ ] Login funciona
- [ ] Datos de prueba cargados
- [ ] 4 patologías y 10+ ejercicios visibles
- [ ] Scripts incluidos en HTML
- [ ] Listo para integrar en código

---

## 🆘 Troubleshooting Rápido

### Problema: "Supabase is not defined"
```javascript
// SOLUCIÓN: Verifica orden de scripts
// Debe estar ANTES de supabase-client.js:
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### Problema: "Invalid API key"
```javascript
// SOLUCIÓN: Copia nuevamente de Supabase Settings → API
// No uses comillas, no añadas espacios
```

### Problema: CORS error
```javascript
// SOLUCIÓN: En Supabase → Authentication → URL Configuration
// Agrega tu URL local:
// http://localhost:8000
// http://localhost:3000
```

### Problema: Sin datos en tablas
```javascript
// SOLUCIÓN: Ejecuta initializeTestData()
// O revisa que el SQL se ejecutó sin errores
```

---

## 📱 Próximos Pasos Después de Esto

1. **Integrar el login existente**
   - Ver archivo `INTEGRATION_EXAMPLE.js`
   - Copiar funciones al login.js actual

2. **Cargar datos de pacientes existentes**
   - Si tienes datos en localStorage
   - Migra a Supabase

3. **Agregar más funcionalidades**
   - Reportes
   - Historial gráfico
   - Notificaciones

4. **Desplegar a producción**
   - Supabase lo hospeda automáticamente
   - Solo necesitas tu aplicación web

---

## 📞 Ayuda Rápida

| Recurso | Link |
|---------|------|
| Documentación | `SUPABASE_SETUP_GUIDE.md` |
| Ejemplos de código | `SUPABASE_EXAMPLES.md` |
| Arquitectura | `ARCHITECTURE.md` |
| Consola Supabase | supabase.com (tu proyecto) |
| Comunidad | discord.supabase.com |

---

## 🎉 ¡Listo!

Ya tienes:
- ✅ Base de datos en la nube
- ✅ Autenticación funcionando
- ✅ Ejercicios y patologías cargadas
- ✅ Todo listo para integrar

**Tiempo total: 30 minutos**

¿Necesitas ayuda? Lee los archivos .md en orden:
1. QUICKSTART.md
2. SUPABASE_EXAMPLES.md
3. SUPABASE_SETUP_GUIDE.md

---

Created with ❤️ | Última actualización: Noviembre 2024
