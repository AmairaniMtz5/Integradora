(function(){
  // Helper functions
  function qs(sel, parent=document){ return parent.querySelector(sel) }
  function qsa(sel, parent=document){ return Array.from(parent.querySelectorAll(sel)) }
  function escapeHtml(text){ const map={ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }; return String(text||'').replace(/[&<>"']/g,m=>map[m]); }

  // Debug panel helper (deshabilitado para producción)
  function appendDebug(msg, obj){
    // Debug deshabilitado - usar console.log en su lugar
    // console.log('[debug]', msg, obj);
    return;
  }

  let currentPatientId = null;
  let currentAdjustmentId = null;
  let currentConfirmCallback = null;
  // Base absoluta a la carpeta de videos del Administrador (root del server es /)
  // El servidor http-server se lanzó con raíz en "front-end", por lo tanto
  // las URLs absolutas deben comenzar en "/Administrador/Ejercicios/"
  const exercisesBaseUrl = new URL('/Administrador/Ejercicios/', window.location.origin);

  function getVideoManifestEntry(videoId){
    const manifest = Array.isArray(window.__exerciseVideoManifest) ? window.__exerciseVideoManifest : [];
    return manifest.find(entry => entry && (entry.id === videoId || String(entry.id) === String(videoId))) || null;
  }

  function attachVideoFromPath(videoPath, container, isModalContext = false) {
    if (!videoPath || !container) return;
    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.preload = 'metadata';
    videoEl.playsInline = true;
    videoEl.style.width = '100%';
    videoEl.style.borderRadius = '8px';
    videoEl.style.maxHeight = isModalContext ? '200px' : '220px';
    videoEl.style.objectFit = 'cover';
    videoEl.style.display = 'block';
    videoEl.src = new URL(videoPath, exercisesBaseUrl).href;
    
    // Event listeners para debug
    videoEl.addEventListener('loadedmetadata', () => {
      console.log('[video] Metadata cargada:', videoEl.src);
    });
    videoEl.addEventListener('error', (e) => {
      console.error('[video] Error cargando:', videoEl.src, videoEl.error);
      container.innerHTML = '<div class="video-placeholder" style="color:#dc2626;">❌ Error: video no encontrado</div>';
    });
    
    const wrapper = document.createElement('div');
    wrapper.className = 'exercise-video-preview';
    wrapper.appendChild(videoEl);
    container.innerHTML = '';
    container.appendChild(wrapper);
    try { console.log('[attachVideoFromPath] Attached', videoEl.src); } catch(_) {}
  }

  // Attach video using an absolute URL (e.g., Supabase public URL)
  function attachVideoFromAbsoluteUrl(absoluteUrl, container, isModalContext = false) {
    if (!absoluteUrl || !container) return;
    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.preload = 'metadata';
    videoEl.playsInline = true;
    videoEl.style.width = '100%';
    videoEl.style.borderRadius = '8px';
    videoEl.style.maxHeight = isModalContext ? '200px' : '220px';
    videoEl.style.objectFit = 'cover';
    videoEl.style.display = 'block';
    videoEl.src = absoluteUrl;
    
    // Event listeners para debug
    videoEl.addEventListener('loadedmetadata', () => {
      console.log('[video] Metadata cargada:', videoEl.src);
    });
    videoEl.addEventListener('error', (e) => {
      console.error('[video] Error cargando:', videoEl.src, videoEl.error);
      container.innerHTML = '<div class="video-placeholder" style="color:#dc2626;">❌ Error: video no disponible</div>';
    });
    
    const wrapper = document.createElement('div');
    wrapper.className = 'exercise-video-preview';
    wrapper.appendChild(videoEl);
    container.innerHTML = '';
    container.appendChild(wrapper);
    try { console.log('[attachVideoFromAbsoluteUrl] Attached', videoEl.src); } catch(_) {}
  }

  // Modal confirmation functions
  function showConfirmModal(title, message, onConfirm) {
    qs('#confirmTitle').textContent = title;
    qs('#confirmMessage').textContent = message;
    currentConfirmCallback = onConfirm;
    qs('#confirmModal').classList.add('show');
  }

  function closeConfirmModal() {
    qs('#confirmModal').classList.remove('show');
    currentConfirmCallback = null;
  }

  function confirmAction() {
    if (currentConfirmCallback) {
      currentConfirmCallback();
    }
    closeConfirmModal();
  }

  function showAlertModal(title, message) {
    qs('#confirmTitle').textContent = title;
    qs('#confirmMessage').textContent = message;
    // Hide the cancel button and show a single OK button
    const cancelBtn = qs('#confirmModal .confirm-modal-actions .btn-secondary') || qs('#confirmModal .confirm-modal-footer .btn-secondary');
    if (cancelBtn) cancelBtn.style.display = 'none';
    const confirmBtn = qs('#confirmBtn') || qs('#confirmActionBtn');
    if (confirmBtn) {
      confirmBtn.style.display = 'inline-block';
      confirmBtn.textContent = 'Aceptar';
      confirmBtn.onclick = closeConfirmModal;
    }
    qs('#confirmModal').classList.add('show');
  }

  function closeAlertModal() {
    // Restore buttons
    const cancelBtn = qs('#confirmModal .confirm-modal-actions .btn-secondary') || qs('#confirmModal .confirm-modal-footer .btn-secondary');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    const confirmBtn = qs('#confirmBtn') || qs('#confirmActionBtn');
    if (confirmBtn) {
      confirmBtn.style.display = 'inline-block';
      // restore default behavior if any
      confirmBtn.onclick = executeConfirmAction;
    }
    closeConfirmModal();
  }
  let currentConfirmAction = null; // Store callback for confirmation

  // Get patient ID from URL
  function getPatientIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('patientId') || params.get('id');
    return raw ? decodeURIComponent(String(raw).trim()) : '';
  }

  function getPatientEmailFromUrl(){
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    return email ? String(email).trim() : '';
  }

  // Get patient data (single implementation)
  async function getPatientDataFromSupabase(patientId) {
    try {
      const client = window.supabaseServiceClient || window.supabaseClient;
      if (!client || !patientId) return { error: 'Supabase no disponible o patientId vacío', patientId };
      console.log('[getPatientDataFromSupabase] Buscando paciente con ID:', patientId);
      appendDebug('Buscando paciente',{patientId});
      
      // Intentar buscar por ID (UUID)
      let { data, error } = await client
        .from('patients')
        .select('id, first_name, last_name, email, phone, age, medical_history')
        .eq('id', patientId)
        .maybeSingle();
      console.log('[getPatientDataFromSupabase] Respuesta por ID:', { data, error });
      
      // Fallback 1: Si no funciona, intentar con el email de la URL
      if (!data) {
        const email = getPatientEmailFromUrl();
        if (email) {
          console.log('[getPatientDataFromSupabase] Fallback: buscando por email de URL:', email);
          const result = await client
            .from('patients')
            .select('id, first_name, last_name, email, phone, age, medical_history')
            .eq('email', email)
            .maybeSingle();
          data = result.data;
          error = result.error;
          console.log('[getPatientDataFromSupabase] Respuesta por email URL:', { data, error });
        }
      }
      
      // Fallback 2: Si el patientId parece un email, buscar por email
      if (!data && patientId.includes('@')) {
        console.log('[getPatientDataFromSupabase] Fallback: patientId parece email, buscando:', patientId);
        const result = await client
          .from('patients')
          .select('id, first_name, last_name, email, phone, age, medical_history')
          .eq('email', patientId)
          .maybeSingle();
        data = result.data;
        error = result.error;
        console.log('[getPatientDataFromSupabase] Respuesta por email patientId:', { data, error });
      }
      
      if (error || !data) {
        const email = getPatientEmailFromUrl();
        return { error: error ? error.message : 'No encontrado en ninguna búsqueda', patientId, email };
      }
      appendDebug('Paciente encontrado',{id:data.id,email:data.email});
      let photo = '';
      if (data.email) {
        const { data: user } = await client.from('users').select('photo_url').eq('email', data.email).maybeSingle();
        if (user && user.photo_url) photo = user.photo_url;
      }
      return {
        id: data.id,
        name: [data.first_name, data.last_name].filter(Boolean).join(' '),
        email: data.email,
        phone: data.phone,
        age: data.age,
        photo,
        diagnosis: data.medical_history,
        status: data.status || 'Activo'
      };
    } catch(e) { return { error: e.message, patientId }; }
  }

  // Get exercise details by ID (primero intenta desde window.__defaultExercises, luego Supabase)
  function getExerciseDetails(exerciseId) {
    try {
      // Intentar desde caché global primero
      const defaults = window.__defaultExercises || {};
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

  // Cargar ejercicios desde Supabase si no están en caché
  async function ensureExercisesLoaded() {
    if (window.__defaultExercises && Object.keys(window.__defaultExercises).length > 0) {
      return; // Ya están cargados
    }
    
    try {
      const client = window.supabaseClientTherapist || window.supabaseClient;
      if (!client) return;

      const { data, error } = await client.from('exercises').select('*');
      if (error) {
        console.warn('[perfil-paciente] Error cargando ejercicios:', error.message);
        return;
      }

      const grouped = {};
      (data || []).forEach(ex => {
        const pathology = ex.pathology || 'general';
        if (!grouped[pathology]) grouped[pathology] = [];
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
      console.log('[perfil-paciente] Ejercicios cargados desde Supabase');
    } catch(e) {
      console.error('[perfil-paciente] Error cargando ejercicios:', e);
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

  // Get assignments for this patient
  function normalizeId(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function getCurrentTherapistId() {
    const cur = window.__currentUser || null;
    if (!cur) return null;
    return normalizeId(cur.id || cur._id || cur.therapistId || cur.assignedTherapist || '');
  }

  function resolvePatientRef(value) {
    if (!value) return '';
    if (typeof value === 'object') {
      return resolvePatientRef(value.id || value._id || value.code || value.patientId || value.email || value.name);
    }
    return normalizeId(value);
  }

  function matchesPatientAssignment(assignment, targetId) {
    if (!assignment || !targetId) return false;
    const patientRef = resolvePatientRef(assignment.patientId || assignment.patient || assignment.patientName);
    if (patientRef && patientRef === targetId) return true;
    const altRef = resolvePatientRef(assignment.patientCode || assignment.patient_id);
    if (altRef && altRef === targetId) return true;
    return false;
  }

  function matchesTherapistAssignment(assignment, therapistId) {
    if (!assignment || !therapistId) return false;
    const owner = assignment.therapistId || assignment.assignedTo || assignment.assignedTherapist || assignment.terapeutaAsignado || assignment.assigned;
    if (owner && normalizeId(owner) === therapistId) return true;
    if (assignment.therapist) {
      return normalizeId(assignment.therapist) === therapistId;
    }
    return false;
  }

  // Get assignments from Supabase for patient (with fallback email)
  async function getPatientAssignmentsFromSupabase(patientId){
    try{
      const client = window.supabaseServiceClient || window.supabaseClient;
      if(!client || !patientId){ return []; }
      const email = getPatientEmailFromUrl();
      let assignments = [];
      // primary by patient_id
      const { data: byId, error: errId } = await client
        .from('assigned_exercises')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at',{ascending:false});
      if(!errId && Array.isArray(byId)) assignments = byId;
      // fallback by email only if empty
      if(assignments.length===0 && email){
        const { data: byEmail, error: errEmail } = await client
          .from('assigned_exercises')
          .select('*')
          .eq('patient_email', email)
          .order('created_at',{ascending:false});
        if(!errEmail && Array.isArray(byEmail)) assignments = byEmail;
      }
      console.log('[perfil-paciente] Asignaciones encontradas:', assignments.length);
      appendDebug('Asignaciones encontradas',{count:assignments.length});
      return assignments;
    }catch(e){ console.warn('[perfil-paciente] getPatientAssignmentsFromSupabase error', e.message); return []; }
  }

  // Initialize
  async function init() {
    currentPatientId = getPatientIdFromUrl();
    console.log('[perfil-paciente] ID obtenido de URL:', currentPatientId);
    appendDebug('Init perfil paciente',{rawId:currentPatientId});
    if (!currentPatientId) {
      showAlertModal('Error', 'No se especificó el paciente');
      setTimeout(() => history.back(), 2000);
      return;
    }

    // Cargar ejercicios desde Supabase
    await ensureExercisesLoaded();

    // Indicador inicial y verificación de cliente Supabase
    const metaEl = qs('#pfMeta');
    if(metaEl) metaEl.textContent = 'Cargando datos del paciente…';
    if(!window.supabaseClient && !window.supabaseServiceClient){
      console.warn('[perfil-paciente] Cliente Supabase no disponible al inicio');
    } else {
      console.log('[perfil-paciente] Cliente Supabase detectado');
    }

    console.log('[perfil-paciente] Consultando Supabase con ID:', currentPatientId);
    const patient = await getPatientDataFromSupabase(currentPatientId);
    console.log('[perfil-paciente] Resultado de Supabase:', patient);
    
    if (patient && patient.error) {
      const email = getPatientEmailFromUrl();
      showAlertModal('Paciente no encontrado', `ID buscado: ${escapeHtml(patient.patientId || '')}<br>Email buscado: ${escapeHtml(email || patient.email || '')}<br>Error: ${escapeHtml(patient.error)}`);
      appendDebug('Paciente no encontrado',patient);
      const pfName = qs('#pfName');
      if (pfName) pfName.innerHTML = `Paciente no encontrado<br>ID: ${escapeHtml(patient.patientId || '')}<br>Email: ${escapeHtml(email || patient.email || '')}<br>Error: ${escapeHtml(patient.error)}`;
      // Aún así intentar mostrar ejercicios
      await migrateAssignmentsEmailToUuid();
      await renderAssignedExercisesFromSupabase();
      return;
    }
    
    if (!patient) {
      showAlertModal('Error', 'Paciente no encontrado (sin datos)');
      return;
    }
    
    // IMPORTANTE: Actualizar currentPatientId con el UUID real de Supabase
    currentPatientId = patient.id;
    console.log('[perfil-paciente] UUID real del paciente:', currentPatientId);
    appendDebug('UUID real paciente',{uuid:currentPatientId});
    
    // Intentar migración de asignaciones por email -> patient_id (UUID)
    await migrateAssignmentsEmailToUuid();
    if (patient.error) {
      // Continuar para intentar mostrar ejercicios por email/patient_id fallback
      await renderAssignedExercisesFromSupabase();
      return;
    }
    // Set patient info
    qs('#pfName').textContent = escapeHtml(patient.name || 'Paciente');
    if (patient.photo) {
      qs('#pfAvatar').src = patient.photo;
    }
    // Build meta info
    const metaParts = [];
    if (patient.age) metaParts.push(`Edad: ${patient.age}`);
    if (patient.phone) metaParts.push(`Tel: ${patient.phone}`);
    if (patient.status) metaParts.push(`Estado: ${patient.status}`);
    qs('#pfMeta').textContent = metaParts.join(' · ') || 'Sin información';
    appendDebug('Meta paciente',{meta:metaParts});
    // Guardar paciente en localStorage cache para otras vistas si se requiere
    try {
      const cacheKey = 'last_viewed_patient';
      localStorage.setItem(cacheKey, JSON.stringify(patient));
    } catch(_) { /* ignore */ }
    // Message button
    qs('#msgPatientBtn').addEventListener('click', () => {
      localStorage.setItem('selected_patient_chat', currentPatientId);
      window.location.href = '../messages.html';
    });
    // Render exercises
    await renderAssignedExercisesFromSupabase();

    // Diagnóstico adicional si no hay meta poblada
    try {
      if(metaEl && metaEl.textContent === 'Sin información') {
        metaEl.textContent += ' (verifique que el paciente tenga age/phone/status en tabla patients)';
      }
    }catch(_){ }
  }

  // Render assigned exercises
  async function renderAssignedExercisesFromSupabase() {
    const container = qs('#assignedExercisesList');
    const assignments = await getPatientAssignmentsFromSupabase(currentPatientId);
    container.innerHTML = '';
    if (!assignments.length) {
      const emailFallback = getPatientEmailFromUrl();
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No hay ejercicios asignados aún</div><div style="margin-top:6px;font-size:11px;color:#64748b">Diagnóstico: buscado por patient_id=' + escapeHtml(String(currentPatientId)) + (emailFallback? (' y patient_email=' + escapeHtml(emailFallback)):'') + '. Verifique filas en assigned_exercises.</div></div>';
      appendDebug('Sin ejercicios',{patientId:currentPatientId});
      return;
    }
    appendDebug('Render ejercicios',{total:assignments.length});

    // Agrupar por patología y semana
    const grouped = {};
    for (const assignment of assignments) {
      const pathology = getPathologyName(assignment.pathology || 'General');
      const week = assignment.assignment_week || 'Sin semana';
      if (!grouped[pathology]) grouped[pathology] = {};
      if (!grouped[pathology][week]) grouped[pathology][week] = [];
      grouped[pathology][week].push(assignment);
    }

    // Renderizar grupos
    Object.entries(grouped).forEach(([pathology, weeks]) => {
      const pathologySection = document.createElement('section');
      pathologySection.className = 'exercise-pathology-group';
      pathologySection.innerHTML = `<h4 class="exercise-pathology-title">${escapeHtml(pathology)}</h4>`;
      Object.entries(weeks).forEach(([week, items]) => {
        const weekDiv = document.createElement('div');
        weekDiv.className = 'exercise-week-group';
        weekDiv.innerHTML = `<div class="exercise-week-title">${escapeHtml(week)}</div>`;
        items.forEach(assignment => {
          let exercise = getExerciseDetails(assignment.exercise_id);
          if (!exercise) {
            exercise = { name: assignment.exercise_id, pathology: assignment.pathology };
          }
          try {
            console.log('[perfil-paciente] Resolución de ejercicio:', {
              assignmentId: assignment.id,
              exerciseId: assignment.exercise_id,
              found: !!exercise,
              hasMediaRef: !!(exercise && exercise.mediaRef),
              hasMediaUrl: !!(exercise && exercise.media),
              exercise
            });
          } catch(_) {}
          const card = document.createElement('div');
          card.className = 'exercise-card';
          card.dataset.assignmentId = assignment.id;
          const exerciseName = escapeHtml(exercise.name);
          const daysText = Array.isArray(assignment.therapist_assigned_days) ? assignment.therapist_assigned_days.join(', ') : '-';
          const videoContainerId = `video-${assignment.id}`;
          card.innerHTML = `
            <div class="exercise-card-header">
              <div class="exercise-card-icon">🎬</div>
              <div style="flex: 1;">
                <h4 class="exercise-card-title">${exerciseName}</h4>
              </div>
            </div>
            <div class="exercise-video-container" id="${videoContainerId}"></div>
            <div class="exercise-card-body">
              <div class="exercise-detail">
                <span class="exercise-detail-label">Repeticiones:</span>
                <span class="exercise-detail-value">${escapeHtml(assignment.therapist_reps || '-')}</span>
              </div>
              <div class="exercise-detail">
                <span class="exercise-detail-label">Días:</span>
                <span class="exercise-detail-value">${escapeHtml(daysText)}</span>
              </div>
              ${assignment.assignment_week ? `
                <div class="exercise-detail">
                  <span class="exercise-detail-label">Semana:</span>
                  <span class="exercise-detail-value">${escapeHtml(assignment.assignment_week)}</span>
                </div>
              ` : ''}
              ${assignment.therapist_notes ? `
                <div class="exercise-detail">
                  <span class="exercise-detail-label">Notas:</span>
                  <span class="exercise-detail-value">${escapeHtml(assignment.therapist_notes)}</span>
                </div>
              ` : ''}
            </div>
          `;
          weekDiv.appendChild(card);
          
          // Cargar el video después de agregar la tarjeta al DOM
          // Usar querySelector directo en la tarjeta en vez de getElementById
          const videoContainer = card.querySelector(`#${videoContainerId}`);
          if (videoContainer) {
            if (exercise.mediaRef) {
              console.log('[perfil-paciente] Cargando video por mediaRef', exercise.mediaRef);
              loadExerciseVideoPreview(exercise.mediaRef, videoContainer, assignment.pathology);
            } else if (exercise.media) {
              console.log('[perfil-paciente] Cargando video por URL directa', exercise.media);
              attachVideoFromAbsoluteUrl(exercise.media, videoContainer);
            } else {
              videoContainer.innerHTML = '<div class="video-placeholder">Sin video disponible</div>';
            }
          } else {
            console.warn('[perfil-paciente] No se encontró contenedor de video:', videoContainerId);
          }
        });
        pathologySection.appendChild(weekDiv);
      });
      container.appendChild(pathologySection);
    });
  }

  // Load video preview dispatcher (bundled or user)
  function loadExerciseVideoPreview(mediaRef, container, pathologyKey) {
    console.log('[loadExerciseVideoPreview] Called with:', {mediaRef, hasContainer: !!container, pathologyKey});
    if (!container) {
      console.warn('[loadExerciseVideoPreview] No container provided');
      return;
    }
    container.innerHTML = '<div class="exercise-video-preview"><div class="video-placeholder">⏳ Cargando video...</div></div>';
    if (mediaRef.type === 'bundled') {
      console.log('[loadExerciseVideoPreview] Loading bundled video:', mediaRef.id);
      loadBundledVideoForExercise(mediaRef.id, container, pathologyKey);
    } else if (mediaRef.type === 'user') {
      console.log('[loadExerciseVideoPreview] Loading user video:', mediaRef.id);
      loadUserVideoForExercise(mediaRef.id, container);
    } else {
      console.warn('[loadExerciseVideoPreview] Unknown mediaRef type:', mediaRef.type);
    }
  }

  // Load bundled video (search manifest by pathology, fallback to global)
  function loadBundledVideoForExercise(videoId, container, pathologyKey) {
    try {
      console.log('[loadBundledVideoForExercise] Looking for videoId:', videoId);
      console.log('[loadBundledVideoForExercise] Manifest entries:', window.__exerciseVideoManifest?.length || 0);
      const cachedEntry = getVideoManifestEntry(videoId);
      console.log('[loadBundledVideoForExercise] Found entry:', cachedEntry);
      if (cachedEntry && cachedEntry.path) {
        console.log('[loadBundledVideoForExercise] Attaching video from path:', cachedEntry.path);
        attachVideoFromPath(cachedEntry.path, container);
        return;
      }

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

      let tried = 0;
      const tryNext = () => {
        if (tried >= paths.length) {
          container.innerHTML = '<div class="video-placeholder">Video no disponible</div>';
          return;
        }
        const manifestPath = paths[tried];
        fetch(manifestPath)
          .then(r => {
            if (!r.ok) throw new Error('Not found');
            const manifestUrl = r.url;
            return r.json().then(manifest => ({ manifest, manifestUrl }));
          })
          .then(({ manifest, manifestUrl }) => {
            const video = manifest.find(v => v.id === videoId || String(v.id) === String(videoId));
            if (video && video.path) {
              attachVideoFromPath(video.path, container);
            } else {
              tried++;
              tryNext();
            }
          })
          .catch(() => {
            tried++;
            tryNext();
          });
      };
      tryNext();
    } catch (e) {
      container.innerHTML = '<div class="video-placeholder">Error al cargar video</div>';
    }
  }

  // Load user video from localStorage metadata
  function loadUserVideoForExercise(videoId, container) {
    try {
      const metas = JSON.parse(localStorage.getItem('user_videos_meta') || '[]');
      const meta = metas.find(m => m.id === videoId || String(m.id) === String(videoId));
      if (meta && meta.storedIn === 'local' && meta.dataUrl) {
        const videoEl = document.createElement('video');
        videoEl.controls = true;
        videoEl.style.width = '100%';
        videoEl.style.borderRadius = '8px';
        videoEl.style.maxHeight = '220px';
        videoEl.src = meta.dataUrl;
        container.innerHTML = '';
        container.appendChild(videoEl);
      } else {
        container.innerHTML = '<div class="video-placeholder">Video no disponible</div>';
      }
    } catch (e) {
      container.innerHTML = '<div class="video-placeholder">Error al cargar video</div>';
    }
  }

  // Open adjust modal
  function openAdjustModal(assignmentId) {
    const assignments = getPatientAssignments(currentPatientId);
    const assignment = assignments.find(a => a.id === assignmentId);
    
    if (!assignment) return;

    const exercise = getExerciseDetails(assignment.exerciseId);
    if (!exercise) return;

    currentAdjustmentId = assignmentId;

    // Populate form with therapist's assigned data
    qs('#adjExName').value = escapeHtml(exercise.name || '');
    qs('#adjExReps').value = assignment.therapistReps || '';
    qs('#adjExDuration').value = (assignment.therapistAssignedDays ? assignment.therapistAssignedDays.join(', ') : '') || '';
    qs('#adjExNotes').value = assignment.therapistNotes || '';

    // Show modal
    qs('#adjustExerciseModal').classList.add('show');
  }

  // Close adjust modal
  function closeAdjustExerciseModal() {
    qs('#adjustExerciseModal').classList.remove('show');
    currentAdjustmentId = null;
  }

  // Remove exercise
  function removeExercise(assignmentId) {
    showConfirmDialog(
      '¿Eliminar este ejercicio del paciente?',
      async () => {
        try {
          const client = window.supabaseServiceClient || window.supabaseClient;
          if (!client) throw new Error('Supabase no disponible');
          const { error } = await client
            .from('assigned_exercises')
            .delete()
            .eq('id', assignmentId);
          if (error) throw error;
          await renderAssignedExercisesFromSupabase();
          showAlertModal('Éxito', 'Ejercicio eliminado');
        } catch(e) {
          console.error('Error removing exercise:', e);
          showAlertModal('Error', 'Error al eliminar el ejercicio');
        }
      }
    );
  }

  // Migrate legacy assignments that only have patient_email to set patient_id (UUID)
  async function migrateAssignmentsEmailToUuid() {
    try {
      const client = window.supabaseServiceClient || window.supabaseClient;
      if (!client) return;
      const email = getPatientEmailFromUrl();
      const patientId = currentPatientId;
      if (!email || !patientId) return;
      const { data: byEmail } = await client
        .from('assigned_exercises')
        .select('id')
        .eq('patient_email', email)
        .is('patient_id', null);
      if (Array.isArray(byEmail) && byEmail.length) {
        const ids = byEmail.map(r => r.id);
        console.log('[migrate] Actualizando', ids.length, 'asignaciones para setear patient_id');
        const { error } = await client
          .from('assigned_exercises')
          .update({ patient_id: patientId })
          .in('id', ids);
        if (error) {
          console.warn('[migrate] Error al actualizar asignaciones:', error.message);
        } else {
          console.log('[migrate] Asignaciones actualizadas exitosamente');
        }
      }
    } catch(e) {
      console.warn('[migrate] excepción:', e);
    }
  }

  // Show confirmation dialog modal
  function showConfirmDialog(message, callback) {
    currentConfirmAction = callback;
    qs('#confirmMessage').textContent = message;
    qs('#confirmModal').classList.add('show');
  }

  // Close confirmation modal
  function closeConfirmModal() {
    qs('#confirmModal').classList.remove('show');
    currentConfirmAction = null;
  }

  // Execute the confirmed action
  function executeConfirmAction() {
    if (currentConfirmAction && typeof currentConfirmAction === 'function') {
      currentConfirmAction();
    }
    closeConfirmModal();
  }

  // Handle form submit
  qs('#adjustExerciseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentAdjustmentId) return;

    const reps = qs('#adjExReps').value.trim();
    const daysText = qs('#adjExDuration').value.trim();
    const notes = qs('#adjExNotes').value.trim();

    if (!reps) {
      showAlertModal('Atención', 'Por favor ingresa las repeticiones');
      return;
    }

    try {
      const client = window.supabaseServiceClient || window.supabaseClient;
      if (!client) throw new Error('Supabase no disponible');
      // Actualiza los campos relevantes en la base de datos
      const updateFields = {
        therapist_reps: reps,
        therapist_notes: notes,
        therapist_assigned_days: daysText.split(',').map(d => d.trim()).filter(Boolean)
      };
      const { error } = await client
        .from('assigned_exercises')
        .update(updateFields)
        .eq('id', currentAdjustmentId);
      if (error) throw error;
      showAlertModal('Éxito', 'Cambios guardados');
      closeAdjustExerciseModal();
      await renderAssignedExercisesFromSupabase();
    } catch(e) {
      console.error('Error saving adjustment:', e);
      showAlertModal('Error', 'Error al guardar los cambios');
    }
  });

  // Escape HTML
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // Click outside modal to close
  document.addEventListener('click', (e) => {
    const modal = qs('#adjustExerciseModal');
    if (e.target === modal) {
      closeAdjustExerciseModal();
    }
    const confirmModal = qs('#confirmModal');
    if (e.target === confirmModal) {
      closeConfirmModal();
    }
  });

  // Keep exercises in sync with other tabs
  window.addEventListener('assigned-exercises:updated', renderAssignedExercisesFromSupabase);
  window.addEventListener('storage', (e) => {
    if (e.key === 'assigned_exercises') {
      renderAssignedExercisesFromSupabase();
    }
  });

  // Expose functions globally
  window.currentApp = {
    openAdjustModal,
    closeAdjustExerciseModal,
    removeExercise
  };

  // Also expose individual functions as globals to match inline onclick handlers
  window.openAdjustModal = openAdjustModal;
  window.closeAdjustExerciseModal = closeAdjustExerciseModal;
  window.removeExercise = removeExercise;
  window.closeConfirmModal = closeConfirmModal;
  window.executeConfirmAction = executeConfirmAction;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
