(function(){
  console.log('[ejercicios] Script iniciado');
  // Helper functions
  function qs(sel, parent=document){ return parent.querySelector(sel) }
  function qsa(sel, parent=document){ return Array.from(parent.querySelectorAll(sel)) }

  let selectedPatientId = null;
  let currentAssigningExerciseId = null;
  let cachedPatients = [];
  let cachedAssignedExercises = [];

  // Get therapist ID
  function getCurrentTherapistId() {
    try {
      const therapist = (window.__currentUser) ? window.__currentUser : null;
      return therapist ? (therapist.id || therapist._id || null) : null;
    } catch(e) {
      return null;
    }
  }

  // Get therapist patients
  function filterAssignedPatients(patients, therapistId) {
    if(!therapistId) return []; 
    return (patients||[]).filter(p => String(p.assignedTherapist || p.assigned || '') === String(therapistId));
  }

  function getTherapistPatients() {
    try {
      const therapistId = getCurrentTherapistId();
      return filterAssignedPatients(Array.isArray(cachedPatients) ? cachedPatients : [], therapistId);
    } catch(e) {
      return [];
    }
  }

  // Get exercises assigned to a PATIENT by the ADMIN
  function getPatientAdminExercises(patientId) {
    try {
      const assigned = Array.isArray(cachedAssignedExercises) ? cachedAssignedExercises : [];
      console.log('[ejercicios] Total asignaciones en cache:', assigned.length);
      console.log('[ejercicios] Buscando ejercicios para patient_id:', patientId);
      
      // Filter: ALL exercises assigned to this patient (both configured and unconfigured)
      const filtered = assigned.filter(a => {
        const pid = a.patientId || a.patient || a.patientName;
        const matchesPatient = pid && String(pid) === String(patientId);
        
        if (matchesPatient) {
          const isConfigured = a.therapistAssignedDays && Array.isArray(a.therapistAssignedDays) && a.therapistAssignedDays.length > 0;
          console.log('[ejercicios] Ejercicio:', a.exerciseId, 'configurado:', isConfigured);
        }
        
        return matchesPatient;
      });
      
      console.log('[ejercicios] Total ejercicios encontrados:', filtered.length);
      return filtered;
    } catch(e) {
      console.error('[ejercicios] Error en getPatientAdminExercises:', e);
      return [];
    }
  }

  // Get exercise details by ID
  function getExerciseDetails(exerciseId) {
    try {
      const defaults = (window.__defaultExercises && typeof window.__defaultExercises === 'object') ? window.__defaultExercises : {};
      for (const pathologyKey in defaults) {
        const exercises = defaults[pathologyKey] || [];
        const ex = exercises.find(e => e.id === exerciseId);
        if (ex) {
          ex.pathology = pathologyKey;
          return ex;
        }
      }
      return null;
    } catch(e) {
      return null;
    }
  }

  // Get pathology name from key
  function getPathologyName(key) {
    const map = {
      'espondilolisis': 'Espondilólisis',
      'escoliosis': 'Escoliosis lumbar',
      'hernia': 'Hernia de disco lumbar',
      'lumbalgia': 'Lumbalgia mecánica inespecífica'
    };
    return map[key] || key;
  }

  // HTML escape
  function escapeHtml(text) {
    if(!text) return '';
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // Render patients list
  function renderPatients() {
    const container = qs('#patientsList');
    const patients = getTherapistPatients();
    // Update patients header with count
    try {
      const headerH2 = qs('.patients-section .section-header h2');
      if (headerH2) {
        headerH2.innerHTML = `👥 Mis Pacientes <span class="patient-count-badge">${patients.length}</span>`;
      }
    } catch (e) {
      // ignore
    }
    container.innerHTML = '';

    if (!patients.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">No tienes pacientes asignados</div></div>';
      return;
    }

    patients.forEach(patient => {
      const exercises = getPatientAdminExercises(patient.id);
      
      const card = document.createElement('div');
      card.className = 'patient-card-item' + (selectedPatientId === patient.id ? ' active' : '');
      
      const initials = patient.name ? patient.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';
      const avatar = patient.photo 
        ? `<img src="${patient.photo}" alt="${escapeHtml(patient.name)}">`
        : initials;
      
      card.innerHTML = `
        <div class="patient-avatar">${avatar}</div>
        <div class="patient-info">
          <div class="patient-name">${escapeHtml(patient.name || 'Paciente sin nombre')}</div>
          <div class="patient-exercise-count">${exercises.length} ejercicio${exercises.length !== 1 ? 's' : ''}</div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        selectedPatientId = patient.id;
        renderPatients();
        renderExercises();
      });
      
      container.appendChild(card);
    });
  }

  // Render available exercises for selected patient
  function renderExercises() {
    const container = qs('#exercisesAvailable');
    const titleEl = qs('#selectedPatientTitle');
    const subtitleEl = qs('#selectedPatientSubtitle');
    
    if (!selectedPatientId) {
      titleEl.textContent = 'Selecciona un paciente';
      subtitleEl.textContent = 'Elige un paciente para ver ejercicios disponibles';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👈</div>
          <div class="empty-state-text">Selecciona un paciente de la lista</div>
          <div class="empty-state-subtext">Usa la columna izquierda para elegir y ver ejercicios</div>
        </div>
      `;
      return;
    }

    const patients = getTherapistPatients();
    const patient = patients.find(p => p.id === selectedPatientId);
    
    if (patient) {
      titleEl.textContent = `Ejercicios para ${escapeHtml(patient.name)}`;
      subtitleEl.textContent = `${escapeHtml(patient.status || 'Paciente')} • ${escapeHtml(patient.diagnosis || 'Diagnóstico pendiente')}`;
    
        // Update patient details section
        const detailsEl = qs('#patientDetails');
        if (detailsEl && patient) {
          const ageEl = qs('#patientAge');
          const diagnosisEl = qs('#patientDiagnosis');
      
          if (ageEl && patient.age) {
            ageEl.textContent = `📅 ${patient.age} años`;
          }
          if (diagnosisEl && patient.diagnosis) {
            diagnosisEl.textContent = `🏥 ${patient.diagnosis}`;
          }
          detailsEl.style.display = 'flex';
        }
    }

    const exercises = getPatientAdminExercises(selectedPatientId);
    
    console.log('[ejercicios] Ejercicios a mostrar:', exercises.length);
    console.log('[ejercicios] window.__defaultExercises:', window.__defaultExercises);
    
    container.innerHTML = '';
    
    if (!exercises.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✓</div><div class="empty-state-text">Todos los ejercicios han sido asignados</div></div>';
      return;
    }

    exercises.forEach(assignment => {
      console.log('[ejercicios] Procesando asignación:', assignment.exerciseId, 'pathology:', assignment.pathology);
      const exerciseDetails = getExerciseDetails(assignment.exerciseId);
      
      if (!exerciseDetails) {
        console.warn('[ejercicios] ⚠️ No se encontraron detalles para exercise_id:', assignment.exerciseId);
        console.log('[ejercicios] Asignación completa:', assignment);
        return;
      }
      
      console.log('[ejercicios] ✓ Detalles encontrados:', exerciseDetails.name);

      const pathologyName = getPathologyName(assignment.pathology);
      const isConfigured = assignment.therapistAssignedDays && Array.isArray(assignment.therapistAssignedDays) && assignment.therapistAssignedDays.length > 0;
      
      const card = document.createElement('div');
      card.className = 'exercise-card' + (isConfigured ? ' configured' : '');
      card.dataset.assignmentId = assignment.id;
      
      let videoHtml = '';
      if (exerciseDetails.mediaRef) {
        videoHtml = `
          <div class="exercise-video-container" id="video-${assignment.id}">
            <div class="video-placeholder">
              <div class="video-loading">⏳ Cargando video...</div>
            </div>
          </div>
        `;
      }
      
      // Badge de estado
      const statusBadge = isConfigured 
        ? '<span class="status-badge configured">✓ Configurado</span>'
        : '<span class="status-badge pending">⚠ Pendiente</span>';
      
      // Info de configuración si existe
      let configInfo = '';
      if (isConfigured) {
        const days = assignment.therapistAssignedDays.join(', ');
        const reps = assignment.therapistReps || 'No especificado';
        configInfo = `
          <div class="config-info">
            <div class="config-item"><strong>Repeticiones:</strong> ${escapeHtml(reps)}</div>
            <div class="config-item"><strong>Días:</strong> ${escapeHtml(days)}</div>
            ${assignment.therapistNotes ? `<div class="config-item"><strong>Notas:</strong> ${escapeHtml(assignment.therapistNotes)}</div>` : ''}
          </div>
        `;
      }
      
      card.innerHTML = `
        <div class="exercise-header">
          <div class="exercise-icon">🎬</div>
          <div class="exercise-title">
            <h3>${escapeHtml(exerciseDetails.name)}</h3>
            <p class="exercise-pathology">${escapeHtml(pathologyName)}</p>
          </div>
          ${statusBadge}
        </div>
        ${videoHtml}
        <div class="exercise-body">
          <p class="exercise-desc">${escapeHtml(exerciseDetails.desc || 'Sin descripción')}</p>
          ${configInfo}
        </div>
        <div class="exercise-footer">
          <button class="btn ${isConfigured ? 'btn-secondary' : 'btn-primary'}" onclick="window.app.openAssignModal('${assignment.id}', '${escapeHtml(exerciseDetails.name)}')">
            ${isConfigured ? '✏️ Editar Configuración' : '🚀 Asignar Ahora'}
          </button>
        </div>
      `;
      
      container.appendChild(card);
      
      // Load video after card is added to DOM
      if (exerciseDetails.mediaRef) {
        loadExerciseVideo(exerciseDetails.mediaRef, `video-${assignment.id}`, exerciseDetails.pathology);
      }
    });
  }

  const exercisesBaseUrl = new URL('../../Administrador/Ejercicios/', window.location.href);

  function getVideoManifestEntry(videoId) {
    const manifest = Array.isArray(window.__exerciseVideoManifest) ? window.__exerciseVideoManifest : [];
    return manifest.find(item => item && (item.id === videoId || String(item.id) === String(videoId))) || null;
  }

  function attachVideoFromPath(videoPath, container, isModalContext=false) {
    if (!videoPath) return;
    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.style.width = '100%';
    videoEl.style.borderRadius = '10px';
    videoEl.style.maxHeight = isModalContext ? '200px' : '300px';
    videoEl.style.objectFit = 'cover';
    videoEl.src = new URL(videoPath, exercisesBaseUrl).href;
    container.innerHTML = '';
    container.appendChild(videoEl);
  }

  // Load video for exercise
  function loadExerciseVideo(mediaRef, containerSelector, pathologyKey) {
    let videoContainer;
    let isModalContext = false;
    
    // Support both element IDs and actual container elements
    if (typeof containerSelector === 'string') {
      videoContainer = qs(`#${containerSelector}`);
      isModalContext = containerSelector === 'assignExerciseVideo';
    } else {
      videoContainer = containerSelector;
      isModalContext = videoContainer.id === 'assignExerciseVideo';
    }
    
    if (!videoContainer) return;

    if (mediaRef.type === 'bundled') {
      // Try to load bundled video
      loadBundledVideoForExercise(mediaRef.id, videoContainer, isModalContext, pathologyKey);
    } else if (mediaRef.type === 'user') {
      // Try to load user video
      loadUserVideoForExercise(mediaRef.id, videoContainer, isModalContext);
    }
  }

  // Load bundled video
  function loadBundledVideoForExercise(videoId, container, isModalContext = false, pathologyKey = '') {
    try {
      const cachedEntry = getVideoManifestEntry(videoId);
      if (cachedEntry && cachedEntry.path) {
        attachVideoFromPath(cachedEntry.path, container, isModalContext);
        return;
      }

      // Build pathology-specific manifest URL
      const pathologyMap = {
        'espondilolisis': 'Espondilólisis',
        'escoliosis': 'Escoliosis lumbar',
        'hernia': 'Hernia de disco lumbar',
        'lumbalgia': 'Lumbalgia mecánica inespecífica'
      };
      
      const pathologyName = pathologyMap[pathologyKey] || pathologyKey || '';
      
      const paths = [];
      if (pathologyName) {
        paths.push(`../../Administrador/Ejercicios/videos/${encodeURIComponent(pathologyName)}/manifest.json`);
      }
      paths.push('../../Administrador/Ejercicios/videos/manifest.json');
      paths.push('../../../Administrador/Ejercicios/videos/manifest.json');

      let pathTried = 0;
      const tryNextPath = () => {
        if (pathTried >= paths.length) {
          container.innerHTML = '<div class="video-placeholder"><div class="video-error">No se pudo cargar el video</div></div>';
          return;
        }
        
        const manifestPath = paths[pathTried];
        fetch(manifestPath)
          .then(r => {
            if (!r.ok) throw new Error('Not found');
            const manifestUrl = r.url;
            return r.json().then(manifest => ({ manifest, manifestUrl }));
          })
          .then(({ manifest, manifestUrl }) => {
            const video = manifest.find(v => v.id === videoId || String(v.id) === String(videoId));
            if (video && video.path) {
              attachVideoFromPath(video.path, container, isModalContext);
            } else {
              pathTried++;
              tryNextPath();
            }
          })
          .catch(() => {
            pathTried++;
            tryNextPath();
          });
      };
      
      tryNextPath();
    } catch(e) {
      container.innerHTML = '<div class="video-placeholder"><div class="video-error">Error al cargar video</div></div>';
    }
  }

  // Load user video
  function loadUserVideoForExercise(videoId, container, isModalContext = false) {
    try {
      const metas = Array.isArray(window.__userVideosMeta) ? window.__userVideosMeta : [];
      const meta = metas.find(m => m.id === videoId);
      
      if (meta) {
        const videoEl = document.createElement('video');
        videoEl.controls = true;
        videoEl.width = '100%';
        videoEl.style.borderRadius = '10px';
        videoEl.style.maxHeight = isModalContext ? '200px' : '300px';
        videoEl.style.objectFit = 'cover';
        
        if (meta.storedIn === 'local' && meta.dataUrl) {
          videoEl.src = meta.dataUrl;
          container.innerHTML = '';
          container.appendChild(videoEl);
        } else {
          container.innerHTML = '<div class="video-placeholder"><div class="video-error">Video no disponible</div></div>';
        }
      } else {
        container.innerHTML = '<div class="video-placeholder"><div class="video-error">Video no encontrado</div></div>';
      }
    } catch(e) {
      container.innerHTML = '<div class="video-placeholder"><div class="video-error">Error al cargar video</div></div>';
    }
  }

  // Open assign modal
  function openAssignModal(assignmentId, exerciseName) {
    currentAssigningExerciseId = assignmentId;
    qs('#assignExerciseName').textContent = exerciseName;
    
    // Get current assignment to preload values if editing
    const assignments = getPatientAdminExercises(selectedPatientId);
    const assignment = assignments.find(a => a.id === assignmentId);
    
    // Preload existing values if configured
    if (assignment && assignment.therapistAssignedDays && assignment.therapistAssignedDays.length > 0) {
      qs('#assignReps').value = assignment.therapistReps || '';
      qs('#assignNotes').value = assignment.therapistNotes || '';
      
      // Check the assigned days
      qsa('input[name="day"]').forEach(chk => {
        chk.checked = assignment.therapistAssignedDays.includes(chk.value);
      });
    } else {
      // Reset form for new assignment
      qs('#assignReps').value = '';
      qs('#assignNotes').value = '';
      qsa('input[name="day"]').forEach(chk => chk.checked = false);
    }
    
    // Load video in modal
    const videoContainer = qs('#assignExerciseVideo');
    videoContainer.innerHTML = '';
    
    try {
      if (assignment) {
        const exerciseDetails = getExerciseDetails(assignment.exerciseId);
        if (exerciseDetails && exerciseDetails.mediaRef) {
          // Pass the container element directly for modal video loading
          loadExerciseVideo(exerciseDetails.mediaRef, videoContainer, exerciseDetails.pathology);
        }
      }
    } catch(e) {
      console.error('Error loading video preview:', e);
    }
    
    qs('#assignModal').classList.add('show');
  }

  // Close assign modal
  function closeAssignModal() {
    qs('#assignModal').classList.remove('show');
  }

  // Handle form submit
  qs('#assignForm').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!currentAssigningExerciseId) {
      alert('Error: ejercicio no seleccionado');
      return;
    }

    const reps = qs('#assignReps').value.trim();
    if (!reps) {
      alert('Por favor ingresa las repeticiones');
      return;
    }

    const selectedDays = Array.from(qsa('input[name="day"]:checked')).map(chk => chk.value);
    if (!selectedDays.length) {
      alert('Por favor selecciona al menos un día de la semana');
      return;
    }

    const notes = qs('#assignNotes').value.trim();

    // Update assignment in Supabase
    (async () => {
      try {
        const client = window.supabaseServiceClient || window.supabaseClient;
        if (!client) {
          alert('Error: Cliente Supabase no disponible');
          return;
        }

        const { data, error } = await client
          .from('assigned_exercises')
          .update({
            therapist_assigned_days: selectedDays,
            therapist_reps: reps,
            therapist_notes: notes,
            therapist_assigned_at: new Date().toISOString()
          })
          .eq('id', currentAssigningExerciseId)
          .select()
          .single();

        if (error) {
          console.error('Error actualizando asignación:', error);
          alert('Error al guardar: ' + error.message);
          return;
        }

        console.log('[ejercicios] Asignación actualizada:', data);

        // Update in-memory cache
        const assigned = Array.isArray(window.__assignedExercises) ? window.__assignedExercises : [];
        const index = assigned.findIndex(a => a.id === currentAssigningExerciseId);
        if (index !== -1) {
          assigned[index].therapistAssignedDays = selectedDays;
          assigned[index].therapistReps = reps;
          assigned[index].therapistNotes = notes;
          assigned[index].therapistAssignedAt = new Date().toISOString();
          window.__assignedExercises = assigned;
          cachedAssignedExercises = assigned.slice();
        }

        try {
          window.dispatchEvent(new CustomEvent('assigned-exercises:updated', { detail: assigned.slice() }));
        } catch (e) {
          console.warn('assigned-exercises event falló', e);
        }

        closeAssignModal();
        renderExercises();
      } catch(e) {
        console.error('Error saving assignment:', e);
        alert('Error al guardar la asignación');
      }
    })();
  });

  // Close modal on outside click
  qs('#assignModal').addEventListener('click', (e) => {
    if (e.target.id === 'assignModal') {
      closeAssignModal();
    }
  });

  // Expose functions globally
  window.app = {
    openAssignModal,
    closeAssignModal
  };

  // Also expose functions directly for onclick handlers
  window.openAssignModal = openAssignModal;
  window.closeAssignModal = closeAssignModal;

  // (Patient search removed) patients are listed directly in the UI

  // Load default exercises from Supabase
  async function loadDefaultExercises() {
    try {
      const client = window.supabaseClientTherapist || window.supabaseClient;
      if (!client) {
        console.warn('[ejercicios] No hay cliente Supabase disponible');
        window.__defaultExercises = {};
        return;
      }

      console.log('[ejercicios] Cargando ejercicios desde Supabase...');
      const { data, error } = await client
        .from('exercises')
        .select('*');

      if (error) {
        console.error('[ejercicios] Error cargando ejercicios de Supabase:', error.message);
        window.__defaultExercises = {};
        return;
      }

      // Agrupar por patología (formato compatible con código existente)
      const grouped = {};
      (data || []).forEach(ex => {
        const pathology = ex.pathology || 'general';
        if (!grouped[pathology]) {
          grouped[pathology] = [];
        }
        grouped[pathology].push({
          id: ex.video_id || ex.id,
          name: ex.name,
          desc: ex.description || '',
          meta: ex.meta || '',
          icon: ex.icon || '📝',
          media: ex.video_url,
          mediaRef: ex.media_ref || null,
          mediaName: ex.media_name || '',
          pathology: ex.pathology
        });
      });

      window.__defaultExercises = grouped;
      console.log('[ejercicios] Ejercicios cargados desde Supabase:', Object.keys(grouped).length, 'patologías');
      console.log('[ejercicios] Total ejercicios:', Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0));
    } catch(e) {
      console.error('[ejercicios] Error cargando ejercicios por defecto:', e);
      window.__defaultExercises = {};
    }
  }

  async function refreshCache(){
    console.log('[ejercicios] refreshCache llamado');
    await loadDefaultExercises(); // Cargar ejercicios por defecto (ahora async)
    cachedPatients = Array.isArray(window.__therapistPatients) ? window.__therapistPatients.slice() : [];
    cachedAssignedExercises = Array.isArray(window.__assignedExercises) ? window.__assignedExercises.slice() : [];
    console.log('[ejercicios] Pacientes cargados:', cachedPatients.length);
    console.log('[ejercicios] Ejercicios asignados:', cachedAssignedExercises.length);
    console.log('[ejercicios] window.__defaultExercises:', window.__defaultExercises);
    if(selectedPatientId && !cachedPatients.some(p => String(p.id) === String(selectedPatientId))){
      selectedPatientId = null;
    }
    renderPatients();
    renderExercises();
  }

  ['therapist-patients:loaded','therapist-manager:loaded','patients:updated','storage','assigned-exercises:loaded'].forEach(evt => {
    window.addEventListener(evt, () => {
      console.log('[ejercicios] Evento recibido:', evt);
      refreshCache();
    });
  });

  // Inicialización asíncrona
  (async () => {
    await refreshCache();
    
    // Si después de 500ms aún no hay datos, intentar de nuevo
    setTimeout(() => {
      if (cachedPatients.length === 0 || cachedAssignedExercises.length === 0) {
        console.log('[ejercicios] Retry: re-cargando datos después de timeout');
        refreshCache();
      }
    }, 500);
  })();
})();
