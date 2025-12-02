document.addEventListener('DOMContentLoaded', async () => {
  const loadingContainer = document.getElementById('loadingContainer');
  const emptyState = document.getElementById('emptyState');
  const exercisesList = document.getElementById('exercisesList');
  const statusFilter = document.getElementById('statusFilter');
  const patientFilter = document.getElementById('patientFilter');

  let currentTherapistId = null;
  let allExercises = [];
  let patients = [];

  // Obtener cliente Supabase
  const client = window.supabaseClientTherapist || window.supabaseClient || window.supabaseServiceClient;

  if (!client) {
    console.error('No se encontró cliente Supabase');
    alert('Error de conexión. Por favor, recarga la página.');
    return;
  }

  // Obtener terapeuta autenticado
  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    
    if (sessionError || !sessionData?.session?.user) {
      console.error('Usuario no autenticado:', sessionError);
      alert('No estás autenticado. Redirigiendo al login...');
      setTimeout(() => {
        window.location.href = '../login/index.html';
      }, 1500);
      return;
    }
    
    currentTherapistId = sessionData.session.user.id;
    console.log('Terapeuta autenticado:', currentTherapistId);
    
    await loadData();
    setupFilters();
    
  } catch (err) {
    console.error('Error en inicialización:', err);
    alert('Error al cargar los datos: ' + err.message);
  }

  async function loadData() {
    try {
      loadingContainer.style.display = 'block';
      emptyState.style.display = 'none';
      exercisesList.innerHTML = '';

      // Cargar pacientes del terapeuta
      const { data: patientsData, error: patientsError } = await client
        .from('patients')
        .select('id, first_name, last_name, email, medical_history')
        .eq('therapist_id', currentTherapistId);

      if (patientsError) {
        console.error('Error cargando pacientes:', patientsError);
      } else {
        patients = patientsData || [];
        populatePatientFilter();
      }

      // Cargar ejercicios asignados por el administrador
      const { data: exercisesData, error: exercisesError } = await client
        .from('admin_assigned_exercises')
        .select(`
          id,
          patient_id,
          exercise_id,
          admin_id,
          pathology,
          status,
          notes,
          assigned_at,
          exercises (
            id,
            name,
            description,
            video_url
          ),
          patients (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .in('patient_id', patients.map(p => p.id));

      if (exercisesError) {
        console.error('Error cargando ejercicios:', exercisesError);
        throw exercisesError;
      }

      allExercises = exercisesData || [];
      console.log('Ejercicios cargados:', allExercises.length);

      renderExercises();

    } catch (err) {
      console.error('Error en loadData:', err);
      alert('Error al cargar ejercicios: ' + err.message);
    } finally {
      loadingContainer.style.display = 'none';
    }
  }

  function populatePatientFilter() {
    patientFilter.innerHTML = '<option value="">Todos los pacientes</option>';
    patients.forEach(patient => {
      const option = document.createElement('option');
      option.value = patient.id;
      option.textContent = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.email;
      patientFilter.appendChild(option);
    });
  }

  function setupFilters() {
    statusFilter.addEventListener('change', renderExercises);
    patientFilter.addEventListener('change', renderExercises);
  }

  function renderExercises() {
    const selectedStatus = statusFilter.value;
    const selectedPatient = patientFilter.value;

    let filtered = allExercises;

    // Filtrar por estado
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(ex => ex.status === selectedStatus);
    }

    // Filtrar por paciente
    if (selectedPatient) {
      filtered = filtered.filter(ex => ex.patient_id === selectedPatient);
    }

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      exercisesList.innerHTML = '';
      return;
    }

    emptyState.style.display = 'none';
    exercisesList.innerHTML = '';

    filtered.forEach(exercise => {
      const card = createExerciseCard(exercise);
      exercisesList.appendChild(card);
    });
  }

  function createExerciseCard(exercise) {
    const card = document.createElement('div');
    card.className = `exercise-card ${exercise.status}`;

    const patientName = exercise.patients 
      ? `${exercise.patients.first_name || ''} ${exercise.patients.last_name || ''}`.trim() || exercise.patients.email
      : 'Paciente desconocido';

    const exerciseName = exercise.exercises?.name || 'Ejercicio sin nombre';
    const exerciseDesc = exercise.exercises?.description || '';
    const assignedDate = new Date(exercise.assigned_at).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const statusText = {
      'pending': 'Pendiente',
      'approved': 'Aprobado',
      'rejected': 'Rechazado'
    }[exercise.status] || exercise.status;

    card.innerHTML = `
      <div class="exercise-header">
        <div class="exercise-info">
          <div class="exercise-name">${exerciseName}</div>
          <div class="exercise-meta">
            <div class="meta-item">
              <span>👤</span>
              <strong>Paciente:</strong> ${patientName}
            </div>
            <div class="meta-item">
              <span>🏥</span>
              <strong>Patología:</strong> ${exercise.pathology || 'No especificada'}
            </div>
          </div>
          ${exerciseDesc ? `<p style="color: #64748b; font-size: 14px; margin-top: 8px;">${exerciseDesc}</p>` : ''}
          ${exercise.notes ? `
            <div class="exercise-notes">
              <strong>Notas del administrador:</strong>
              ${exercise.notes}
            </div>
          ` : ''}
          <div class="assigned-date">Asignado el ${assignedDate}</div>
        </div>
        <span class="status-badge ${exercise.status}">${statusText}</span>
      </div>

      ${exercise.status === 'pending' ? `
        <div class="exercise-actions">
          <button class="btn-approve" onclick="approveExercise('${exercise.id}')">
            ✓ Aprobar y Asignar
          </button>
          <button class="btn-reject" onclick="rejectExercise('${exercise.id}')">
            ✗ Rechazar
          </button>
        </div>
      ` : ''}
    `;

    return card;
  }

  // Función global para aprobar ejercicio
  window.approveExercise = async (exerciseId) => {
    if (!confirm('¿Deseas aprobar este ejercicio y asignarlo al paciente?')) {
      return;
    }

    try {
      // Llamar a la función RPC de Supabase
      const { error } = await client.rpc('approve_admin_exercise', {
        admin_exercise_id: exerciseId,
        therapist_user_id: currentTherapistId
      });

      if (error) {
        console.error('Error aprobando ejercicio:', error);
        alert('Error al aprobar el ejercicio: ' + error.message);
        return;
      }

      alert('✓ Ejercicio aprobado y asignado al paciente exitosamente');
      await loadData(); // Recargar lista

    } catch (err) {
      console.error('Error en approveExercise:', err);
      alert('Error al aprobar ejercicio: ' + err.message);
    }
  };

  // Función global para rechazar ejercicio
  window.rejectExercise = async (exerciseId) => {
    const reason = prompt('¿Por qué rechazas este ejercicio? (opcional)');
    
    if (reason === null) return; // Usuario canceló

    try {
      const { error } = await client
        .from('admin_assigned_exercises')
        .update({ 
          status: 'rejected',
          notes: reason ? `Rechazado: ${reason}` : 'Rechazado por el terapeuta'
        })
        .eq('id', exerciseId);

      if (error) {
        console.error('Error rechazando ejercicio:', error);
        alert('Error al rechazar el ejercicio: ' + error.message);
        return;
      }

      alert('✗ Ejercicio rechazado');
      await loadData(); // Recargar lista

    } catch (err) {
      console.error('Error en rejectExercise:', err);
      alert('Error al rechazar ejercicio: ' + err.message);
    }
  };
});
