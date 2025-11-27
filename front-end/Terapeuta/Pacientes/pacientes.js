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
    if(patient.assigned) candidates.push(patient.assigned);
    return candidates.some(c => normalizeId(c) === targetNorm);
  }

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function getTherapistName(id){ if(!id) return null; const ts = Array.isArray(window.__therapists) ? window.__therapists : []; const t = ts.find(x=>x.id===id); return t ? t.name : id; }

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
    const therapistName = getTherapistName(p.assignedTherapist);
    const showTherapist = therapistName && therapistName.length > 0 && !therapistName.match(/^[a-z0-9]{8,}$/i);

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
            <span class="detail-value">${escapeHtml(p.age || '--')} años</span>
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
        <button class="btn btn-primary" onclick="window.location.href='perfil-paciente.html?patientId=${encodeURIComponent(p.id)}'">
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

  function renderList(opts={search:''}){
    let list = patients.slice();
    if(therapistId){ list = list.filter(p=> therapistMatches(p, therapistId)); }
    if(opts.search){ const q = opts.search.toLowerCase(); list = list.filter(p=> ((p.name||'') + ' ' + (p.diagnosis||'')).toLowerCase().includes(q)); }

    container.innerHTML = '';
    if(list.length===0){ const notice = document.createElement('div'); notice.className='empty-state'; notice.textContent='No hay pacientes que coincidan con el filtro.'; container.appendChild(notice); }
    else { list.forEach(p=> container.appendChild(makeCard(p))); }
    updateCount(list.length);
  }

  function refreshPatients(){
    updateTherapistId();
    patients = readPatients();
    renderList({ search: (document.getElementById('searchInput')?.value||'') });
  }

  // initial render
  renderList({ search: '' });

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