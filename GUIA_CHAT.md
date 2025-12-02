# 📱💬 Guía de Integración del Chat

## 🎯 Funcionalidades Implementadas

### App Móvil (Paciente)
- ✅ Chat en tiempo real con su terapeuta asignado
- ✅ Carga automática del terapeuta del paciente
- ✅ Envío y recepción de mensajes instantáneos
- ✅ Marcado automático de mensajes como leídos
- ✅ Scroll automático a nuevos mensajes
- ✅ Interfaz limpia y moderna

### App Web (Terapeuta)
- ✅ Lista de todos los pacientes asignados
- ✅ Chat individual con cada paciente
- ✅ Indicador de mensajes no leídos (badge rojo)
- ✅ Sincronización en tiempo real
- ✅ Timestamps en cada mensaje
- ✅ Marcado automático de mensajes leídos

---

## 🗄️ Configuración de Base de Datos

### 1. Ejecutar Script SQL en Supabase

Ve al **SQL Editor** de tu proyecto en Supabase y ejecuta el archivo:
```
SUPABASE_CHAT_SETUP.sql
```

Este script creará:
- **Tabla `messages`**: Almacena todos los mensajes del chat
- **Índices**: Para mejorar el rendimiento de las consultas
- **Políticas RLS**: Seguridad a nivel de filas
- **Realtime**: Habilitación de sincronización en tiempo real

### 2. Estructura de la Tabla `messages`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID único del mensaje |
| `sender_id` | UUID | ID del usuario que envía (FK a auth.users) |
| `receiver_id` | UUID | ID del usuario que recibe (FK a auth.users) |
| `message` | TEXT | Contenido del mensaje |
| `created_at` | TIMESTAMPTZ | Fecha y hora de creación |
| `read` | BOOLEAN | Indica si el mensaje fue leído |

### 3. Políticas de Seguridad (RLS)

- **SELECT**: Los usuarios solo pueden ver mensajes donde son sender o receiver
- **INSERT**: Los usuarios solo pueden enviar mensajes como sender
- **UPDATE**: Los usuarios solo pueden actualizar mensajes donde son receiver (para marcar como leídos)

---

## 🚀 Flujo de Funcionamiento

### Paciente (App Móvil)

1. **Al abrir el chat:**
   - Se obtiene el usuario autenticado actual
   - Se busca el terapeuta asignado desde la tabla `patients`
   - Se cargan todos los mensajes de la conversación
   - Se marcan como leídos los mensajes del terapeuta
   - Se suscribe a nuevos mensajes en tiempo real

2. **Al enviar un mensaje:**
   - Se inserta el mensaje en la tabla `messages`
   - El mensaje aparece inmediatamente en la UI del paciente
   - El mensaje se sincroniza automáticamente al terapeuta vía Realtime

3. **Al recibir un mensaje:**
   - El mensaje aparece automáticamente gracias a la suscripción Realtime
   - Se marca automáticamente como leído
   - Se hace scroll al final del chat

### Terapeuta (App Web)

1. **Al abrir el chat:**
   - Se obtiene el usuario autenticado (terapeuta)
   - Se cargan todos los pacientes asignados a ese terapeuta
   - Se muestra un badge con el número de mensajes no leídos de cada paciente

2. **Al seleccionar un paciente:**
   - Se cargan todos los mensajes de la conversación
   - Se marcan como leídos los mensajes del paciente
   - Se suscribe a nuevos mensajes de ese paciente específico
   - Se actualiza el badge (desaparece si ya no hay no leídos)

3. **Al enviar un mensaje:**
   - Se inserta el mensaje en la tabla `messages`
   - El mensaje aparece inmediatamente en la UI del terapeuta
   - El mensaje se sincroniza automáticamente al paciente vía Realtime

4. **Al recibir un mensaje:**
   - El mensaje aparece automáticamente en el chat actual
   - Se marca automáticamente como leído
   - Se hace scroll al final del chat

---

## 🔄 Sincronización en Tiempo Real

### Tecnología Utilizada
- **Supabase Realtime**: WebSocket que escucha cambios en la tabla `messages`

### En la App Móvil:
```javascript
supabase
  .channel('messages_channel')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `sender_id=eq.${therapistId},receiver_id=eq.${userId}`
  }, (payload) => {
    // Agregar mensaje nuevo a la UI
  })
  .subscribe();
```

### En la App Web:
```javascript
client
  .channel(`messages_${patientId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `sender_id=eq.${patientId},receiver_id=eq.${therapistId}`
  }, (payload) => {
    // Agregar mensaje nuevo a la UI
  })
  .subscribe();
```

---

## 🎨 Interfaz de Usuario

### App Móvil
- **Header**: Muestra el nombre del terapeuta
- **Área de mensajes**: Lista de mensajes con burbujas diferenciadas
  - Mensajes del paciente: Burbuja azul a la derecha
  - Mensajes del terapeuta: Burbuja gris a la izquierda
- **Input**: Campo de texto con botón de envío
- **Botón de regreso**: Vuelve al menú principal

### App Web (Terapeuta)
- **Sidebar izquierdo**: Lista de pacientes
  - Badge rojo con número de no leídos
  - Resaltado del paciente activo
- **Panel principal**: Chat con el paciente seleccionado
  - Header con nombre del paciente
  - Área de mensajes con timestamps
  - Formulario para enviar mensajes

---

## 📊 Ventajas de Esta Implementación

1. **Tiempo Real**: Los mensajes se sincronizan instantáneamente sin necesidad de recargar
2. **Seguridad**: Row Level Security (RLS) garantiza que cada usuario solo vea sus mensajes
3. **Escalabilidad**: Supabase maneja múltiples conexiones simultáneas
4. **Persistencia**: Todos los mensajes se guardan en la base de datos
5. **Estado de lectura**: Sistema de mensajes leídos/no leídos
6. **UX Mejorada**: Scroll automático, indicadores visuales, timestamps

---

## 🧪 Cómo Probar

1. **Ejecutar el script SQL** en Supabase
2. **Iniciar la app móvil** con un usuario paciente que tenga un terapeuta asignado
3. **Abrir la app web** con el usuario del terapeuta correspondiente
4. **Enviar mensajes** desde cualquiera de las dos aplicaciones
5. **Verificar sincronización** en tiempo real en ambas pantallas

---

## 🐛 Solución de Problemas

### Los mensajes no se sincronizan en tiempo real
- Verifica que ejecutaste: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`
- Comprueba en Supabase Dashboard > Database > Replication que `messages` esté habilitado

### No se cargan los pacientes en la app del terapeuta
- Verifica que los pacientes tengan `therapist_id` asignado en la tabla `patients`
- Comprueba que el terapeuta esté autenticado correctamente

### Error: "Could not find the 'messages' relation"
- Asegúrate de haber ejecutado el script SQL completo
- Verifica que la tabla `messages` existe en tu base de datos

### Los mensajes no se marcan como leídos
- Verifica las políticas RLS (el usuario debe poder UPDATE donde es receiver)
- Comprueba en la consola si hay errores de permisos

---

## 📝 Próximas Mejoras (Opcional)

- [ ] Notificaciones push cuando llega un mensaje nuevo
- [ ] Indicador de "escribiendo..." cuando el otro usuario está tecleando
- [ ] Envío de imágenes o archivos adjuntos
- [ ] Búsqueda de mensajes antiguos
- [ ] Eliminar mensajes
- [ ] Reacciones a mensajes (like, etc.)
