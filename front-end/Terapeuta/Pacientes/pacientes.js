// Renderizar la lista de pacientes desde localStorage y soportar búsqueda/filtrado cliente
(function(){
  function readPatients(){
    if(Array.isArray(window.__therapistPatients) && window.__therapistPatients.length){
      return window.__therapistPatients.slice();
    }
    try{ return JSON.parse(localStorage.getItem('therapist_patients')||'[]') || []; }catch(e){ return []; }
  }
  
  const container = document.getElementById('patientsContainer');
  if(!container) return;

  const params = new URLSearchParams(window.location.search);
  let therapistId = null;
  function updateTherapistId(){
    therapistId = params.get('therapist') || (window.__currentUser ? (window.__currentUser.id || window.__currentUser._id) : null) || null;
  }
  updateTherapistId();

  let patients = readPatients();

  // Cargar directamente desde Supabase cuando hay sesión de terapeuta
  async function loadPatientsFromSupabaseForTherapist(){
    try{
      const client = window.supabaseServiceClient || window.supabaseClient;
      if(!client){
        console.warn('[terapeuta] No hay cliente Supabase disponible');
        return [];
      }
      // Usar el terapeuta de la URL si existe; si no, usar el usuario actual
      const cur = window.__currentUser || {};
      console.log('[terapeuta] Usuario actual:', cur.role, cur.email, cur.id);
      const fromQuery = (new URLSearchParams(window.location.search)).get('therapist') || null;
      const therapistUuid = fromQuery || (cur.role === 'therapist' ? cur.id : null);
      console.log('[terapeuta] therapistUuid usado:', therapistUuid, '(fromQuery:', fromQuery, ', cur.id:', cur.id, ', cur.role:', cur.role, ')');
      if(!therapistUuid){
        console.warn('[terapeuta] ⚠️ No se encontró therapist UUID. Si eres admin, necesitas el parámetro ?therapist=<UUID> en la URL');
        return [];
      }
      const { data, error } = await client
        .from('patients')
        .select('id, first_name, last_name, email, phone, medical_history, therapist_id, age, created_at')
        .eq('therapist_id', therapistUuid)
        .order('created_at', { ascending: false });
      console.log('[terapeuta] pacientes cargados para therapistUuid:', (data||[]).length);
      if(error){ console.warn('[terapeuta] cargar pacientes falló:', error.message); return []; }
      
      // Usar photo_url del propio paciente cuando exista (preferido)
      const patientsWithPhotos = await Promise.all((data||[]).map(async (p) => {
        // Preferencia: users.photo_url (por email) > cache local
        let photo = '';
        let fallbackName = '';
        if(p.email){
          try{
            const { data: u } = await client.from('users').select('photo_url, full_name').eq('email', p.email).maybeSingle();
            if(u && u.photo_url){ photo = u.photo_url; }
            if(u && u.full_name){ fallbackName = u.full_name; }
          }catch(e){ console.warn('[terapeuta] fallback users.photo_url error para', p.email, e.message); }
        }
        const nameCombined = ((p.first_name||'') + (p.last_name? (' ' + p.last_name):'')).trim();
        const mapped = {
          id: p.id,
          id_supabase: p.id,
          name: nameCombined || fallbackName || (p.email||'') /* último recurso: email */,
          email: p.email||'',
          phone: p.phone||'',
          diagnosis: p.medical_history||'',
          therapist_id: p.therapist_id||'',
          assignedTherapist: p.therapist_id||'',
          age: (p.age!=null ? p.age : undefined),
          photo,
          status: 'Activo'
        };
        console.log('[terapeuta] mapped patient', mapped.id, { email: mapped.email, age: p.age, mapped_age: mapped.age, photo: mapped.photo });
        return mapped;
      }));
      // Resolver nombres de terapeuta en lote para no mostrar UUID en las cards
      try{
        const client2 = window.supabaseServiceClient || window.supabaseClient;
        if(client2){
          const ids = Array.from(new Set(patientsWithPhotos.map(x=> x.therapist_id).filter(Boolean)));
          for(const tid of ids){
            try{
              const { data } = await client2.from('users').select('full_name, email').eq('id', tid).maybeSingle();
              const name = data ? (data.full_name || data.email || tid) : tid;
              patientsWithPhotos.forEach(x=>{ if(x.therapist_id===tid) x.__therapistName = name; });
            }catch(_){ /* ignore */ }
          }
        }
      }catch(_){ /* ignore */ }
      return patientsWithPhotos;
    }catch(e){ console.warn('[terapeuta] loadPatientsFromSupabaseForTherapist', e.message); return []; }
  }

  function resolveTherapistReference(value){
    if(!value) return '';
    if(typeof value === 'object'){
      return resolveTherapistReference(value._id || value.id || value.therapistId || value.terapeutaAsignado || value.assignedTherapist || value.assigned);
    }
    return String(value);
  }

  function normalizeId(value){ return resolveTherapistReference(value).toLowerCase().replace(/^t/, '').trim(); }
  function therapistMatches(patient, targetId){
    if(!patient || !targetId) return false;
    const targetNorm = normalizeId(targetId);
    const candidates = [];
    if(patient.assignedTherapist) candidates.push(patient.assignedTherapist);
    if(patient.assignedTherapistAlt) candidates.push(patient.assignedTherapistAlt);
    if(patient.therapistId) candidates.push(patient.therapistId);
    // Incluir UUID desde Supabase si está presente
    if(patient.therapist_id) candidates.push(patient.therapist_id);
    if(patient.assigned) candidates.push(patient.assigned);
    return candidates.some(c => normalizeId(c) === targetNorm);
  }

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  // Resolver nombre de terapeuta: primero cache local (__therapists), si no, consultar users por UUID
  const __therapistNameCache = {};
  async function fetchTherapistNameById(id){
    if(!id) return null;
    if(__therapistNameCache[id]) return __therapistNameCache[id];
    const client = window.supabaseServiceClient || window.supabaseClient;
    if(client){
      try{
        const { data, error } = await client.from('users').select('full_name, email').eq('id', id).maybeSingle();
        if(!error && data){
          const name = data.full_name || data.email || id;
          __therapistNameCache[id] = name;
          return name;
        }
      }catch(_){ /* ignore */ }
    }
    return id;
  }
  function getTherapistName(id){
    if(!id) return null;
    const ts = Array.isArray(window.__therapists) ? window.__therapists : [];
    const t = ts.find(x=>x.id===id);
    return t ? t.name : (__therapistNameCache[id] || id);
  }

  function getCurrentTherapistId(){
    const cur = window.__currentUser; if(!cur) return null;
    return cur.id || cur._id || cur.therapistId || cur.assignedTherapist || null;
  }

  function readAssignedExercises(){
    const all = Array.isArray(window.__assignedExercises) ? window.__assignedExercises.slice() : [];
    const therapistId = getCurrentTherapistId();
    if(!therapistId) return all;
    return all.filter(ex => {
      const owner = ex.therapistId || ex.assignedTo || ex.assignedTherapist || ex.terapeutaAsignado || '';
      return String(owner) === String(therapistId);
    });
  }

  function getPatientExercises(patientId){
    if(!patientId) return [];
    const normalizedId = String(patientId);
    return readAssignedExercises().filter(ex => {
      const pid = ex.patientId || ex.patient || ex.patientName || ex.patient_id || ex.patientCode || '';
      return pid && String(pid) === normalizedId;
    });
  }

  function makeCard(p){
    const div = document.createElement('div'); 
    div.className = 'patient-card';
    const statusClass = (p.status && p.status.toLowerCase().includes('activo')) ? 'status-active' : (p.status? 'status-followup' : 'status-inactive');
    
    // Get therapist name, hide if it's just an ID
    const therapistIdVal = p.assignedTherapist || p.therapist_id || null;
    const therapistName = getTherapistName(therapistIdVal);
    const showTherapist = therapistName && therapistName.length > 0 && !therapistName.match(/^[a-f0-9-]{8,}$/i);

    div.innerHTML = `
      <div class="patient-header">
        <div class="patient-avatar"><img src="${escapeHtml(p.photo||'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&h=200&fit=crop&crop=face')}" alt="${escapeHtml(p.name)}"></div>
        <div class="patient-info">
          <h3>${escapeHtml(p.name)}</h3>
          <span class="patient-status ${statusClass}">${escapeHtml(p.status||'Activo')}</span>
        </div>
      </div>
      <div class="patient-details">
        <div class="detail-row">
          <span class="detail-icon">🎂</span>
          <div class="detail-content">
            <span class="detail-label">Edad</span>
            <span class="detail-value">${escapeHtml((p.age!=null && p.age!=='') ? p.age : '--')} años</span>
          </div>
        </div>
        <div class="detail-row">
          <span class="detail-icon">📧</span>
          <div class="detail-content">
            <span class="detail-label">Email</span>
            <span class="detail-value patient-email">${escapeHtml(p.email || '--')}</span>
          </div>
        </div>
        <div class="detail-row">
          <span class="detail-icon">📱</span>
          <div class="detail-content">
            <span class="detail-label">Teléfono</span>
            <span class="detail-value">${escapeHtml(p.phone || '--')}</span>
          </div>
        </div>
        <div class="detail-row diagnosis-row">
          <span class="detail-icon">🏥</span>
          <div class="detail-content">
            <span class="detail-label">Diagnóstico</span>
            <span class="detail-value diagnosis-text">${escapeHtml(p.diagnosis || p.condition || 'General')}</span>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-primary" onclick="window.location.href='perfil-paciente.html?patientId=${encodeURIComponent(p.id_supabase || p.id)}&email=${encodeURIComponent(p.email || '')}'">
          <span class="btn-icon">👤</span> Ver perfil
        </button>
        <button class="btn btn-outline" onclick="window.location.href='../Historial/historial.html?patientId=${encodeURIComponent(p.id)}'">
          <span class="btn-icon">📋</span> Historial
        </button>
        <button class="btn btn-secondary" onclick="window.location.href='../messages.html?patient=${encodeURIComponent(p.name)}'">
          <span class="btn-icon">💬</span> Mensajes
        </button>
      </div>`;
    return div;
  }

  function updateCount(n){ const el = document.getElementById('patientsCountHeader'); if(el) el.textContent = n + (n===1? ' paciente':' pacientes'); }
  function updateTherapistHeader(){
    const el = document.getElementById('therapistHeader');
    const cur = window.__currentUser || {};
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('therapist') || null;
    const fromName = params.get('name') || null;
    const show = fromQuery || cur.id || null;
    if(!el) return;
    // Si viene nombre por URL, úsalo directo
    if(fromName){ el.textContent = 'Terapeuta: ' + fromName; return; }
    // Si hay UUID en la URL, intentar resolver nombre desde users
    (async function(){
      const client = window.supabaseServiceClient || window.supabaseClient;
      if(client && fromQuery){
        try{
          const { data, error } = await client.from('users').select('full_name, email').eq('id', fromQuery).maybeSingle();
          if(!error && data){
            el.textContent = 'Terapeuta: ' + (data.full_name || data.email || fromQuery);
            return;
          }
        }catch(e){ /* ignore */ }
      }
      // Fallback a usuario actual si no hay query
      el.textContent = 'Terapeuta: ' + (cur.full_name || cur.name || cur.email || '--');
    })();
  }

  function renderList(opts={search:''}){
    let list = patients.slice();
    console.log('[terapeuta] renderList: total patients:', patients.length, 'therapistId:', therapistId);
    if(therapistId){ list = list.filter(p=> therapistMatches(p, therapistId)); }
    if(opts.search){ const q = opts.search.toLowerCase(); list = list.filter(p=> ((p.name||'') + ' ' + (p.diagnosis||'')).toLowerCase().includes(q)); }

    container.innerHTML = '';
    if(list.length===0){
      const notice = document.createElement('div');
      notice.className='empty-state';
      const cur = window.__currentUser || {};
      const fromQuery = (new URLSearchParams(window.location.search)).get('therapist') || null;
      if(!fromQuery && cur.role === 'admin'){
        notice.innerHTML = '⚠️ <strong>Necesitas el parámetro therapist en la URL</strong><br>Ejemplo: <code>?therapist=UUID-del-terapeuta</code><br><br>Ve a la página de Terapeutas y haz clic en "Ver pacientes"';
      } else {
        notice.textContent='No hay pacientes asignados a este terapeuta.';
      }
      container.appendChild(notice);
    }
    else { list.forEach(p=> container.appendChild(makeCard(p))); }
    updateCount(list.length);
    updateTherapistHeader();
  }

  function refreshPatients(){
    updateTherapistId();
    patients = readPatients();
    // Intentar cargar también desde Supabase para independencia
    loadPatientsFromSupabaseForTherapist().then(list=>{
      if(Array.isArray(list) && list.length){
        // Fusionar fotos desde cache local si faltan
        const cacheById = {};
        (readPatients()||[]).forEach(p=>{ if(p && p.id) cacheById[String(p.id)] = p; });
        patients = list.map(p => {
          if(!p.photo){
            const cached = cacheById[String(p.id)];
            if(cached && cached.photo){ p.photo = cached.photo; }
          }
          return p;
        });
      }
      renderList({ search: (document.getElementById('searchInput')?.value||'') });
    });
  }

  // initial render: intentar carga Supabase primero
  console.log('[terapeuta] Iniciando carga de pacientes...');
  loadPatientsFromSupabaseForTherapist().then(list=>{
    console.log('[terapeuta] Carga completada, pacientes recibidos:', (list||[]).length);
    if(Array.isArray(list) && list.length){ patients = list; }
    renderList({ search: '' });
  }).catch(err=>{
    console.error('[terapeuta] Error cargando pacientes:', err);
    renderList({ search: '' });
  });

  // wire search filter
  const searchEl = document.getElementById('searchInput'); if(searchEl){ searchEl.addEventListener('input', e=>{ renderList({ search: e.target.value }); }); }
  window.addEventListener('therapist-patients:loaded', function(e){
    if(e && Array.isArray(e.detail)) window.__therapistPatients = e.detail;
    refreshPatients();
  });
  window.addEventListener('therapist-manager:loaded', function(){
    refreshPatients();
  });

  window.__patients = { readPatients };

  // --- Edit / Delete Support ---
  function normalizeStoragePatients(raw){
    if(Array.isArray(raw)) return raw;
    if(raw && typeof raw === 'object'){
      const acc=[]; Object.keys(raw).forEach(k=>{ (raw[k]||[]).forEach(p=>{ if(!p.assignedTherapist) p.assignedTherapist = k; acc.push(p); }); });
      return acc;
    }
    return [];
  }

  function writePatients(raw){
    try{ localStorage.setItem('therapist_patients', JSON.stringify(raw)); }catch(e){ console.warn('writePatients failed', e); }
    try{ window.dispatchEvent(new Event('patients:updated')); }catch(e){}
  }

  function findAndUpdate(raw, id, updater){
    if(Array.isArray(raw)){
      return raw.map(p=> (String(p.id)===String(id) ? updater(p) : p));
    } else if(raw && typeof raw==='object'){
      const out={}; Object.keys(raw).forEach(tid=>{ out[tid] = (raw[tid]||[]).map(p=> (String(p.id)===String(id) ? updater(p) : p)); }); return out;
    }
    return raw;
  }

  function filterOut(raw, id){
    if(Array.isArray(raw)) return raw.filter(p=> String(p.id)!==String(id));
    if(raw && typeof raw==='object'){
      const out={}; Object.keys(raw).forEach(tid=>{ out[tid] = (raw[tid]||[]).filter(p=> String(p.id)!==String(id)); }); return out;
    }
    return raw;
  }

  // Funciones de editar y eliminar deshabilitadas para terapeutas
  // Solo los administradores pueden editar o eliminar pacientes
  
  // Funciones globales para el modal
  window.openActivityModal = function(patientId, patientName) {
    const decodedId = decodeURIComponent(patientId);
    const modal = document.getElementById('activityModal');
    const modalTitle = document.getElementById('activityModalTitle');
    const modalBody = document.getElementById('activityModalBody');
    
    modalTitle.textContent = `Ejercicios asignados a ${patientName}`;

    // Obtener ejercicios del paciente
    const patientExercises = getPatientExercises(decodedId);
    
    if (patientExercises.length === 0) {
      modalBody.innerHTML = '<div class="no-exercises">No hay ejercicios asignados a este paciente.</div>';
    } else {
      modalBody.innerHTML = patientExercises.map(ex => `
        <div class="exercise-card">
          <h4>${escapeHtml(ex.pathology || 'Ejercicio')}</h4>
          <div class="exercise-info-row">
            <span><strong>Repeticiones:</strong> ${escapeHtml(ex.repetitions || '--')}</span>
          </div>
          <div class="exercise-info-row">
            <span><strong>Duración:</strong> ${escapeHtml(ex.duration || '--')}</span>
          </div>
          <div class="exercise-info-row">
            <span><strong>Asignado:</strong> ${new Date(ex.at || Date.now()).toLocaleDateString('es-ES')}</span>
          </div>
          ${ex.description ? `<div class="exercise-description">${escapeHtml(ex.description)}</div>` : ''}
        </div>
      `).join('');
    }
    
    modal.classList.add('show');
  };
  
  window.closeActivityModal = function() {
    const modal = document.getElementById('activityModal');
    modal.classList.remove('show');
  };
  
  // Cerrar modal al hacer click fuera
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('activityModal');
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });
})();