Obsoleto. Ver DOCUMENTACION_UNICA.md

Este archivo contiene ejemplos prácticos de cómo usar los módulos de Supabase en tu aplicación.

## Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Gestión de Pacientes](#gestión-de-pacientes)
3. [Gestión de Terapeutas](#gestión-de-terapeutas)
4. [Ejercicios y Patologías](#ejercicios-y-patologías)
5. [Historial y Progreso](#historial-y-progreso)

---

## Autenticación

### Registro de nuevo usuario

```javascript
async function registerNewTherapist() {
  const result = await window.SupabaseAuth.signUp(
    'terapeuta@clinic.com',
    'securePassword123',
    {
      name: 'Dr. Juan Pérez',
      role: 'therapist',
      clinic: 'Clínica Fisioterapia ABC',
      phone: '+34 912 345 678',
      professional_license: 'CF-12345'
    }
  );

  if (result.success) {
    console.log('Terapeuta registrado:', result.user);
    console.log('Perfil creado:', result.user.id);
  } else {
    console.error('Error:', result.error);
  }
}
```

### Login de usuario

```javascript
async function loginUser(email, password) {
  const result = await window.SupabaseAuth.signIn(email, password);

  if (result.success) {
    console.log('Usuario autenticado:', result.user.email);
    console.log('Rol:', result.profile.role);
    
    // Guardar info en sesión
    sessionStorage.setItem('currentUser', JSON.stringify(result.user));
    sessionStorage.setItem('userProfile', JSON.stringify(result.profile));
  } else {
    console.error('Error de login:', result.error);
  }
}
```

### Logout

```javascript
async function logoutUser() {
  const result = await window.SupabaseAuth.signOut();

  if (result.success) {
    console.log('Usuario desconectado');
    window.location.href = '/login';
  }
}
```

### Obtener usuario actual

```javascript
async function getCurrentUserInfo() {
  const user = await window.SupabaseAuth.getCurrentUser();
  
  if (user) {
    const profile = await window.SupabaseAuth.getUserProfile(user.id);
    console.log('Usuario:', user.email);
    console.log('Perfil:', profile);
  }
}
```

---

## Gestión de Pacientes

### Crear nuevo paciente

```javascript
async function createNewPatient() {
  const result = await window.SupabasePatients.createPatient({
    firstName: 'Carlos',
    lastName: 'González',
    email: 'carlos.gonzalez@email.com',
    phone: '+34 654 321 987',
    dateOfBirth: '1985-05-15',
    gender: 'M',
    clinic: 'Clínica Fisioterapia ABC',
    medicalHistory: 'Dolor lumbar crónico, diabetes tipo 2'
  });

  if (result.success) {
    console.log('Paciente creado:', result.data.id);
    return result.data;
  } else {
    console.error('Error:', result.error);
  }
}
```

### Obtener lista de pacientes

```javascript
async function loadPatients() {
  const result = await window.SupabasePatients.getPatients();

  if (result.success) {
    result.data.forEach(patient => {
      console.log(`${patient.first_name} ${patient.last_name} - ${patient.email}`);
    });
    
    // Renderizar en tabla HTML
    displayPatientsTable(result.data);
  }
}

function displayPatientsTable(patients) {
  const tableBody = document.querySelector('#patientsTable tbody');
  tableBody.innerHTML = '';

  patients.forEach(patient => {
    const row = `
      <tr>
        <td>${patient.first_name} ${patient.last_name}</td>
        <td>${patient.email}</td>
        <td>${patient.phone}</td>
        <td>
          <button onclick="editPatient('${patient.id}')">Editar</button>
          <button onclick="deletePatientRecord('${patient.id}')">Eliminar</button>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });
}
```

### Obtener pacientes de un terapeuta

```javascript
async function getMyPatients(therapistId) {
  const result = await window.SupabasePatients.getPatients(therapistId);

  if (result.success) {
    console.log(`El terapeuta tiene ${result.data.length} pacientes`);
    return result.data;
  }
}
```

### Buscar paciente por nombre

```javascript
async function searchPatient(searchTerm) {
  const result = await window.SupabasePatients.searchPatients(searchTerm);

  if (result.success) {
    console.log(`Se encontraron ${result.data.length} pacientes`);
    return result.data;
  }
}
```

### Actualizar datos del paciente

```javascript
async function updatePatientInfo(patientId) {
  const result = await window.SupabasePatients.updatePatient(patientId, {
    phone: '+34 666 777 888',
    medical_history: 'Dolor lumbar crónico, diabetes tipo 2, lesión en rodilla'
  });

  if (result.success) {
    console.log('Paciente actualizado:', result.data);
  }
}
```

### Asignar paciente a terapeuta

```javascript
async function assignPatientToTherapist(patientId, therapistId) {
  const result = await window.SupabasePatients.assignToTherapist(
    patientId,
    therapistId
  );

  if (result.success) {
    console.log('Paciente asignado al terapeuta');
  }
}
```

### Eliminar paciente

```javascript
async function deletePatientRecord(patientId) {
  if (confirm('¿Estás seguro de que deseas eliminar este paciente?')) {
    const result = await window.SupabasePatients.deletePatient(patientId);

    if (result.success) {
      console.log('Paciente eliminado');
      // Recargar lista
      loadPatients();
    }
  }
}
```

---

## Gestión de Terapeutas

### Crear nuevo terapeuta

```javascript
async function createTherapist() {
  const result = await window.SupabaseTherapists.createTherapist({
    firstName: 'María',
    lastName: 'López',
    email: 'maria.lopez@clinic.com',
    phone: '+34 912 345 678',
    clinic: 'Clínica Fisioterapia ABC',
    specialization: 'Fisioterapia deportiva',
    professionalLicense: 'CF-2023-001'
  });

  if (result.success) {
    console.log('Terapeuta creado:', result.data);
  }
}
```

### Obtener lista de terapeutas

```javascript
async function loadTherapists() {
  const result = await window.SupabaseTherapists.getTherapists();

  if (result.success) {
    console.log(`Se cargaron ${result.data.length} terapeutas`);
    displayTherapistsTable(result.data);
  }
}

function displayTherapistsTable(therapists) {
  const tableBody = document.querySelector('#therapistsTable tbody');
  tableBody.innerHTML = '';

  therapists.forEach(therapist => {
    const row = `
      <tr>
        <td>${therapist.first_name} ${therapist.last_name}</td>
        <td>${therapist.specialization}</td>
        <td>${therapist.clinic}</td>
        <td>${therapist.email}</td>
        <td>
          <button onclick="viewTherapist('${therapist.id}')">Ver</button>
          <button onclick="editTherapist('${therapist.id}')">Editar</button>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });
}
```

### Obtener pacientes de un terapeuta

```javascript
async function getTherapistPatients(therapistId) {
  const result = await window.SupabaseTherapists.getTherapistPatients(therapistId);

  if (result.success) {
    console.log(`${result.data.length} pacientes asignados`);
    return result.data;
  }
}
```

### Buscar terapeuta

```javascript
async function searchTherapist(query) {
  const result = await window.SupabaseTherapists.searchTherapists(query);

  if (result.success) {
    console.log(`Se encontraron ${result.data.length} terapeutas`);
    return result.data;
  }
}
```

---

## Ejercicios y Patologías

### Obtener todas las patologías

```javascript
async function loadPathologies() {
  const result = await window.SupabaseExercises.getPathologies();

  if (result.success) {
    console.log('Patologías disponibles:');
    result.data.forEach(path => {
      console.log(`- ${path.name}: ${path.description}`);
    });
    
    populatePathologyDropdown(result.data);
  }
}

function populatePathologyDropdown(pathologies) {
  const select = document.querySelector('#pathologySelect');
  select.innerHTML = '<option value="">Selecciona una patología</option>';

  pathologies.forEach(path => {
    const option = document.createElement('option');
    option.value = path.id;
    option.textContent = path.name;
    select.appendChild(option);
  });
}
```

### Crear nuevo ejercicio

```javascript
async function createExercise(pathologyId) {
  const result = await window.SupabaseExercises.createExercise({
    name: 'Flexión de cadera',
    description: 'Ejercicio para fortalecer los músculos de la cadera',
    pathologyId: pathologyId,
    videoUrl: 'https://storage.supabase.co/...',
    instructions: '1. Acuéstate boca arriba\n2. Dobla la rodilla\n3. Levanta la pierna',
    durationMinutes: 10,
    difficultyLevel: 'beginner'
  });

  if (result.success) {
    console.log('Ejercicio creado:', result.data);
  }
}
```

### Obtener ejercicios de una patología

```javascript
async function loadExercisesForPathology(pathologyId) {
  const result = await window.SupabaseExercises.getExercisesByPathology(pathologyId);

  if (result.success) {
    displayExercises(result.data);
  }
}

function displayExercises(exercises) {
  const container = document.querySelector('#exercisesContainer');
  container.innerHTML = '';

  exercises.forEach(exercise => {
    const card = `
      <div class="exercise-card">
        <h3>${exercise.name}</h3>
        <p>${exercise.description}</p>
        <p>Duración: ${exercise.duration_minutes} min</p>
        <p>Nivel: ${exercise.difficulty_level}</p>
        <button onclick="playVideo('${exercise.id}')">Ver Video</button>
      </div>
    `;
    container.innerHTML += card;
  });
}
```

### Obtener todos los ejercicios

```javascript
async function loadAllExercises() {
  const result = await window.SupabaseExercises.getExercises();

  if (result.success) {
    console.log(`Se cargaron ${result.data.length} ejercicios`);
    return result.data;
  }
}
```

### Buscar ejercicio

```javascript
async function searchExercises(query) {
  const result = await window.SupabaseExercises.searchExercises(query);

  if (result.success) {
    displayExercises(result.data);
  }
}
```

---

## Historial y Progreso

### Registrar ejercicio completado

```javascript
async function logExerciseCompletion(patientId, exerciseId, therapistId) {
  const result = await window.SupabaseHistory.createHistory({
    patientId: patientId,
    exerciseId: exerciseId,
    therapistId: therapistId,
    datePerformed: new Date().toISOString(),
    durationSeconds: 600, // 10 minutos
    repetitions: 15,
    notes: 'Ejercicio completado correctamente, sin dolor',
    status: 'completed'
  });

  if (result.success) {
    console.log('Registro creado:', result.data.id);
    showNotification('Ejercicio registrado correctamente');
  }
}
```

### Obtener historial del paciente

```javascript
async function viewPatientHistory(patientId) {
  const result = await window.SupabaseHistory.getPatientHistory(patientId);

  if (result.success) {
    displayHistoryTable(result.data);
  }
}

function displayHistoryTable(history) {
  const table = document.querySelector('#historyTable tbody');
  table.innerHTML = '';

  history.forEach(record => {
    const date = new Date(record.date_performed).toLocaleDateString('es-ES');
    const row = `
      <tr>
        <td>${date}</td>
        <td>${record.exercises?.name || 'N/A'}</td>
        <td>${record.duration_seconds / 60} min</td>
        <td>${record.repetitions}</td>
        <td>${record.status}</td>
        <td>${record.notes}</td>
      </tr>
    `;
    table.innerHTML += row;
  });
}
```

### Obtener estadísticas del paciente

```javascript
async function getPatientStatistics(patientId) {
  const result = await window.SupabaseHistory.getPatientStats(patientId);

  if (result.success) {
    console.log('Estadísticas:');
    console.log(`- Total de ejercicios: ${result.data.totalExercises}`);
    console.log(`- Total de minutos: ${Math.round(result.data.totalMinutes)}`);
    console.log(`- Completados: ${result.data.completedCount}`);
    console.log(`- Omitidos: ${result.data.skippedCount}`);
    console.log(`- Último ejercicio: ${result.data.lastPerformed}`);
    
    displayStats(result.data);
  }
}

function displayStats(stats) {
  document.querySelector('#totalExercises').textContent = stats.totalExercises;
  document.querySelector('#totalMinutes').textContent = Math.round(stats.totalMinutes);
  document.querySelector('#completedCount').textContent = stats.completedCount;
  document.querySelector('#skippedCount').textContent = stats.skippedCount;
}
```

### Obtener historial por rango de fechas

```javascript
async function getHistoryByDateRange(patientId, startDate, endDate) {
  const result = await window.SupabaseHistory.getHistoryByDateRange(
    patientId,
    startDate,
    endDate
  );

  if (result.success) {
    console.log(`${result.data.length} registros encontrados`);
    return result.data;
  }
}

// Ejemplo de uso:
// const startDate = '2024-01-01';
// const endDate = '2024-12-31';
// getHistoryByDateRange(patientId, startDate, endDate);
```

### Ver progreso de todos los pacientes de un terapeuta

```javascript
async function viewTherapistPatientsProgress(therapistId) {
  const result = await window.SupabaseHistory.getTherapistPatientsProgress(therapistId);

  if (result.success) {
    const groupedByPatient = {};
    
    // Agrupar registros por paciente
    result.data.forEach(record => {
      const patientId = record.patient_id;
      if (!groupedByPatient[patientId]) {
        groupedByPatient[patientId] = [];
      }
      groupedByPatient[patientId].push(record);
    });
    
    // Mostrar resumen por paciente
    Object.entries(groupedByPatient).forEach(([patientId, records]) => {
      const patient = records[0].patients;
      console.log(`${patient.first_name} ${patient.last_name}: ${records.length} ejercicios registrados`);
    });
  }
}
```

### Actualizar registro de historial

```javascript
async function updateHistoryRecord(historyId, notes) {
  const result = await window.SupabaseHistory.updateHistory(historyId, {
    notes: notes,
    status: 'completed'
  });

  if (result.success) {
    console.log('Registro actualizado');
  }
}
```

---

## Formularios HTML Listos para Usar

### Formulario de Login

```html
<form id="loginForm">
  <div>
    <label>Email:</label>
    <input type="email" id="email" required>
  </div>
  <div>
    <label>Contraseña:</label>
    <input type="password" id="password" required>
  </div>
  <div>
    <label>Rol:</label>
    <select id="role">
      <option value="admin">Administrador</option>
      <option value="therapist">Terapeuta</option>
      <option value="patient">Paciente</option>
    </select>
  </div>
  <button type="submit">Iniciar Sesión</button>
</form>

<script>
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  
  await loginUser(email, password, role);
});
</script>
```

---

¡Estos son los ejemplos más comunes! Puedes combinarlos según tus necesidades específicas.
