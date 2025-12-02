// Vista administrador: perfil de paciente con ejercicios asignados desde Supabase
// Actualizado: 2025-11-30 - Sin photo_url en patients, busca en users
(function(){
  function qs(sel){ return document.querySelector(sel) }
  function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' })[c]); }
  function readDefaults(){ 
    // Intentar desde caché global primero
    if(window.__defaultExercises && Object.keys(window.__defaultExercises).length > 0){
      return window.__defaultExercises;
    }
    // Fallback a localStorage para compatibilidad (deprecated)
    try{ return JSON.parse(localStorage.getItem('default_exercises')||'{}') }catch(e){ return {} } 
  }

  // Cargar ejercicios desde Supabase
  async function loadExercisesFromSupabase() {
    try {
      const client = window.supabaseServiceClient || window.supabaseClient;
      if (!client) return {};

      const { data, error } = await client.from('exercises').select('*');
      if (error) {
        console.warn('[ver_perfil] Error cargando ejercicios:', error.message);
        return {};
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
      return grouped;
    } catch(e) {
      console.error('[ver_perfil] Error cargando ejercicios:', e);
      return {};
    }
  }
  function readUserVideosMeta(){ try{ return JSON.parse(localStorage.getItem('user_videos_meta')||'[]') }catch(e){ return [] } }

  const urlParams = new URLSearchParams(window.location.search);
  const paramPatientId = urlParams.get('patientId') || urlParams.get('id') || '';
  const paramEmail = urlParams.get('email') || '';
  let resolvedPatientId = paramPatientId ? decodeURIComponent(paramPatientId) : '';
  let patientRecord = null;

  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||'')); }
  function getSupabase(){ return window.supabaseServiceClient || window.supabaseClient || null; }

  async function fetchPatient(){
    const client = getSupabase();
    if(!client){ console.warn('[ver_perfil] Supabase no inicializado'); return null; }
    let data=null, error=null;
    if(resolvedPatientId){
      console.log('[ver_perfil] Buscando paciente por ID:', resolvedPatientId);
      ({ data, error } = await client.from('patients').select('id, first_name, last_name, email, phone, age, medical_history').eq('id', resolvedPatientId).maybeSingle());
    }
    if((!data || error) && paramEmail){
      console.log('[ver_perfil] Fallback buscando paciente por email URL:', paramEmail);
      ({ data, error } = await client.from('patients').select('id, first_name, last_name, email, phone, age, medical_history').eq('email', paramEmail).maybeSingle());
    }
    if((!data || error) && resolvedPatientId && resolvedPatientId.includes('@')){
      console.log('[ver_perfil] Fallback patientId parece email:', resolvedPatientId);
      ({ data, error } = await client.from('patients').select('id, first_name, last_name, email, phone, age, medical_history').eq('email', resolvedPatientId).maybeSingle());
    }
    if(!data){
      console.warn('[ver_perfil] Paciente no encontrado', { id: resolvedPatientId, email: paramEmail, error });
      return { error: error ? error.message : 'Paciente no encontrado', id: resolvedPatientId, email: paramEmail };
    }
    let photo = '';
    if(data.email){
      try{
        const { data: user } = await client.from('users').select('photo_url').eq('email', data.email).maybeSingle();
        if(user && user.photo_url) photo = user.photo_url;
      }catch(e){ console.debug('[ver_perfil] error buscando foto', e); }
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
  }

  async function migrateAssignmentsEmailToUuid(){
    const client = getSupabase(); if(!client) return;
    if(!patientRecord || !patientRecord.email || !patientRecord.id) return;
    try{
      // Actualizar filas que tengan solo patient_email
      const { data: pending, error: selErr } = await client
        .from('assigned_exercises')
        .select('id, patient_email, patient_id')
        .is('patient_id', null)
        .eq('patient_email', patientRecord.email);
      if(selErr){ console.debug('[ver_perfil] migrate select error', selErr); return; }
      if(pending && pending.length){
        const updates = pending.map(row => ({ id: row.id, patient_id: patientRecord.id }));
        for(const up of updates){
          const { error: upErr } = await client.from('assigned_exercises').update({ patient_id: patientRecord.id }).eq('id', up.id);
          if(upErr) console.debug('[ver_perfil] migrate update error', up.id, upErr.message);
        }
        console.log('[ver_perfil] Migradas filas assignments -> patient_id:', updates.length);
      }
    }catch(e){ console.debug('[ver_perfil] migrate exception', e); }
  }

  async function fetchAssignments(){
    const client = getSupabase(); if(!client) return [];
    let assignments=[];
    // Preferir patient_id si lo tenemos
    if(patientRecord && patientRecord.id){
      const { data, error } = await client.from('assigned_exercises').select('*').eq('patient_id', patientRecord.id).order('created_at',{ascending:false});
      if(!error && data) assignments.push(...data);
    }
    // Fallback por email si vacío
    if(assignments.length===0 && patientRecord && patientRecord.email){
      const { data, error } = await client.from('assigned_exercises').select('*').eq('patient_email', patientRecord.email).order('created_at',{ascending:false});
      if(!error && data) assignments.push(...data);
    }
    console.log('[ver_perfil] Asignaciones encontradas:', assignments.length);
    return assignments;
  }

  async function deleteAssignment(id){
    const client = getSupabase();
    if(client && isUuid(id)){
      const { error } = await client.from('assigned_exercises').delete().eq('id', id);
      if(error){ alert('Error al eliminar: '+error.message); return; }
      await renderAssignments();
    }else{
      // Legacy localStorage fallback
      const legacy = JSON.parse(localStorage.getItem('assigned_exercises')||'[]').filter(a=>a.id!==id);
      localStorage.setItem('assigned_exercises', JSON.stringify(legacy));
      await renderAssignments();
    }
  }
  window.deleteAssignment = deleteAssignment;

  // IndexedDB helper unificado para videos de usuario (evita duplicados)
  const IDB_NAME = 'integradora-media';
  const IDB_STORE = 'user_videos';
  function openIdb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(IDB_NAME,1);
      req.onupgradeneeded=e=>{ const db=e.target.result; if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE,{keyPath:'id'}); };
      req.onsuccess=e=>resolve(e.target.result);
      req.onerror=e=>reject(e.target.error);
    });
  }
  function idbGetVideo(id){
    return openIdb().then(db=> new Promise((resolve,reject)=>{
      const tx=db.transaction(IDB_STORE,'readonly');
      const store=tx.objectStore(IDB_STORE);
      const r=store.get(id);
      r.onsuccess=()=>{ db.close(); resolve(r.result && r.result.blob ? r.result.blob : null); };
      r.onerror=e=>{ db.close(); reject(e); };
    }));
  }

  // load bundled manifests (reused logic similar to patologia.js)
  let bundledCache = null;
  async function tryFetchManifest(url){ try{ console.debug('[ver_perfil] tryFetchManifest', url); const resp = await fetch(url,{cache:'no-store'}); if(!resp.ok){ console.debug('[ver_perfil] manifest not found', url, resp.status); return []; } const j = await resp.json(); console.debug('[ver_perfil] manifest loaded', url, (Array.isArray(j)? j.length : 0)); return Array.isArray(j)? j : []; }catch(e){ console.debug('[ver_perfil] manifest fetch error', url, e); return [] } }

  // Try multiple folder-name variants (key, human title, slug, encoded) similar to patologia.js
  const titleMap = {
    'espondilolisis': 'Espondilólisis',
    'escoliosis': 'Escoliosis lumbar',
    'hernia': 'Hernia de disco lumbar',
    'lumbalgia': 'Lumbalgia mecánica inespecífica'
  };

  function slugify(s){ try{ return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }catch(e){ return String(s||'').toLowerCase().replace(/\s+/g,'-') } }

  async function loadBundledVideos(){
    if(bundledCache) return bundledCache;
    const collected = [];
    // try a root manifest under Ejercicios/videos
    const root = await tryFetchManifest('../Ejercicios/videos/manifest.json'); 
    if(root && root.length){
      console.log('[ver_perfil] Root manifest loaded:', root.length, 'videos');
      collected.push(...root);
    }

    // Try exact folder names that exist
    const exactFolders = ['Escoliosis lumbar', 'Espondilólisis', 'Hernia de disco lumbar', 'Lumbalgia mecánica inespecífica'];
    for(const folder of exactFolders){
      const url = `../Ejercicios/videos/${encodeURIComponent(folder)}/manifest.json`;
      const arr = await tryFetchManifest(url);
      if(arr && arr.length){
        console.log('[ver_perfil] Loaded manifest from', folder, ':', arr.length, 'videos');
        collected.push(...arr);
      }
    }

    // dedupe
    const seen = new Map(); for(const it of collected){ if(!it) continue; const key = (it.id||'')+'|'+(it.path||''); if(!seen.has(key)) seen.set(key,it); }
    bundledCache = Array.from(seen.values()); console.debug('[ver_perfil] bundled videos total', bundledCache.length); return bundledCache;
  }

  function humanizePathology(k){ if(!k) return '—'; return String(k).replace(/[_-]/g,' ').replace(/\b\w/g, s=>s.toUpperCase()); }

  // Modal helpers for confirmation
  let pendingDeleteId = null;
  function showDeleteModal(assignmentId){
    pendingDeleteId = assignmentId;
    const modal = document.getElementById('deleteModal');
    if(modal) modal.classList.add('show');
  }
  function cancelDeleteAssignment(){
    pendingDeleteId = null;
    const modal = document.getElementById('deleteModal');
    if(modal) modal.classList.remove('show');
  }
  function confirmDeleteAssignment(){
    if(pendingDeleteId){
      deleteAssignment(pendingDeleteId);
      cancelDeleteAssignment();
    }
  }
  window.showDeleteModal = showDeleteModal;
  window.cancelDeleteAssignment = cancelDeleteAssignment;
  window.confirmDeleteAssignment = confirmDeleteAssignment;

  async function renderAssignments(){
    const container = qs('#exercisesContainer'); if(!container) return;
    container.innerHTML = '';
    if(!patientRecord){ container.innerHTML = '<div style="padding:12px;color:#64748b">Paciente no encontrado.</div>'; return; }
    await migrateAssignmentsEmailToUuid();
    const assignments = await fetchAssignments();
    if(!assignments.length){ container.innerHTML = '<div style="padding:12px;color:#64748b">No hay ejercicios asignados a este paciente.</div>'; return; }
    const defaults = readDefaults();
    const bundled = await loadBundledVideos().catch(()=>[]);

    // Agrupar por patología y semana
    const grouped = {};
    for(const a of assignments){
      const pathologyLabel = humanizePathology(a.pathology || '—');
      const weekLabel = a.assignment_week || a.assignmentWeek || 'Sin semana';
      if(!grouped[pathologyLabel]) grouped[pathologyLabel] = {};
      if(!grouped[pathologyLabel][weekLabel]) grouped[pathologyLabel][weekLabel] = [];
      grouped[pathologyLabel][weekLabel].push(a);
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
        items.forEach(a => {
          console.log('[ver_perfil] Procesando asignación completa:', a);
          const list = defaults[a.pathology] || [];
          console.log('[ver_perfil] Lista de ejercicios para', a.pathology, ':', list.length, 'items');
          
          // Intentar múltiples estrategias de búsqueda
          let ex = null;
          const exId = a.exercise_id || a.exerciseId;
          const exName = a.exercise_name || a.exerciseName || a.name;
          
          // 1. Buscar por ID en defaults
          ex = list.find(x=> x.id === exId);
          
          // 2. Buscar por ID en bundled videos
          if(!ex && bundled && bundled.length){
            console.log('[ver_perfil] Buscando en bundled videos, exId:', exId, 'exName:', exName);
            ex = bundled.find(b=> String(b.id) === String(exId));
            if(!ex && exName){
              // 3. Buscar por nombre exacto
              ex = bundled.find(b=> b.name === exName);
            }
            if(ex) console.log('[ver_perfil] Encontrado en bundled:', ex);
          }
          
          // Fallback: si hay nombre de ejercicio pero no metadata, usar el nombre
          if(!ex && exName) {
            ex = { name: exName, desc: a.therapist_notes || '', meta: '' };
          } else if(!ex) {
            // Último fallback: buscar el primer video de la patología si no se encuentra el ejercicio específico
            console.warn('[ver_perfil] No se encontró ejercicio con ID:', exId, '- buscando primer video de la patología');
            const pathologyVideos = bundled.filter(b => {
              const bPath = (b.path || '').toLowerCase();
              const aPath = (a.pathology || '').toLowerCase();
              // Match por patología en la ruta del video
              return bPath.includes('escoliosis') && aPath.includes('escoliosis') ||
                     bPath.includes('espondil') && aPath.includes('espondil') ||
                     bPath.includes('hernia') && aPath.includes('hernia') ||
                     bPath.includes('lumbalgia') && aPath.includes('lumbalgia');
            });
            if(pathologyVideos.length > 0){
              ex = pathologyVideos[0]; // Usar el primer video de la patología
              console.log('[ver_perfil] Usando primer video de patología:', ex.name);
            } else {
              ex = { name: 'Ejercicio #' + (exId || 'sin ID'), desc: '', meta: '' };
            }
          }
          
          const title = ex.name || ex.title || 'Ejercicio';
          const desc = ex.desc || ex.description || a.therapist_notes || '';
          console.log('[ver_perfil] Ejercicio final:', {title, desc, ex, hasPath: !!ex.path});
          const card = document.createElement('div'); card.className='ex-card';
          card.innerHTML = `
            <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
              <div style="flex:0 0 300px"><div class="video-holder" style="background:#f1f5f9;border-radius:8px;padding:6px;display:flex;align-items:center;justify-content:center;min-height:160px"></div></div>
              <div style="flex:1;min-width:240px">
                <h4 style="margin:0 0 6px 0">${escapeHtml(title)}</h4>
                <div style="margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap">
                  <span style="background:#2563eb;color:#fff;padding:6px 12px;border-radius:20px;font-size:0.75rem;font-weight:600">${escapeHtml(pathology)}</span>
                  ${week ? `<span style=\"background:#0d9488;color:#fff;padding:6px 12px;border-radius:20px;font-size:0.7rem;font-weight:600\">Semana: ${escapeHtml(week)}</span>` : ''}
                </div>
                <div style="margin-bottom:8px"><strong>Descripción:</strong><div style="color:#475569;margin-top:4px;font-size:0.85rem">${escapeHtml(desc||'—')}</div></div>
                ${a.therapist_reps ? `<div style=\"margin-bottom:6px;font-size:0.75rem;color:#334155\"><strong>Reps:</strong> ${escapeHtml(a.therapist_reps)}</div>`:''}
                ${Array.isArray(a.therapist_assigned_days) && a.therapist_assigned_days.length ? `<div style=\"margin-bottom:6px;font-size:0.75rem;color:#334155\"><strong>Días:</strong> ${a.therapist_assigned_days.map(d=>escapeHtml(d)).join(', ')}</div>`:''}
                ${a.therapist_notes ? `<div style=\"margin-bottom:6px;font-size:0.75rem;color:#334155\"><strong>Notas:</strong> ${escapeHtml(a.therapist_notes)}</div>`:''}
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                  <small style="color:#64748b;font-size:0.65rem">Asignado: ${new Date(a.created_at || a.therapist_assigned_at || Date.now()).toLocaleString()}</small>
                  <button onclick="showDeleteModal('${a.id}')" style="background:#dc2626;color:#fff;border:none;padding:6px 10px;border-radius:4px;font-size:0.7rem;cursor:pointer">Eliminar</button>
                </div>
              </div>
            </div>`;
          const holder = card.querySelector('.video-holder');
          async function attachBundled(){
            const mediaId = ex.mediaRef && ex.mediaRef.id ? ex.mediaRef.id : ex.media_id || ex.video_id;
            if(ex.media && !ex.mediaRef){ const v=document.createElement('video'); v.controls=true; v.src=ex.media; v.style.maxWidth='100%'; v.style.borderRadius='6px'; holder.appendChild(v); return; }
            if(ex.mediaRef && ex.mediaRef.type === 'bundled'){
              const found = bundled.find(b=> String(b.id) === String(ex.mediaRef.id));
              if(found && found.path){ const v=document.createElement('video'); v.controls=true; v.style.maxWidth='100%'; v.style.borderRadius='6px'; const candidate = found.path.startsWith('videos/') ? ('../Ejercicios/'+found.path) : found.path; v.src=candidate; holder.appendChild(v); return; }
            }
            const byId = bundled.find(b=> mediaId && String(b.id)===String(mediaId));
            if(byId && byId.path){ const v=document.createElement('video'); v.controls=true; v.style.maxWidth='100%'; v.style.borderRadius='6px'; v.src = byId.path.startsWith('videos/')? ('../Ejercicios/'+byId.path): byId.path; holder.appendChild(v); return; }
            const byName = bundled.find(b=> ex.name && b.name && b.name===ex.name);
            if(byName && byName.path){ const v=document.createElement('video'); v.controls=true; v.style.maxWidth='100%'; v.style.borderRadius='6px'; v.src = byName.path.startsWith('videos/')? ('../Ejercicios/'+byName.path): byName.path; holder.appendChild(v); return; }
            // video usuario
            if(ex.mediaRef && ex.mediaRef.type==='user'){ const metas=readUserVideosMeta(); const m=metas.find(x=> String(x.id)===String(ex.mediaRef.id)); if(m){ const v=document.createElement('video'); v.controls=true; v.style.maxWidth='100%'; v.style.borderRadius='6px'; holder.appendChild(v); try{ if(m.storedIn==='local'&&m.dataUrl) v.src=m.dataUrl; else if(m.storedIn==='session'&&m.sessionUrl) v.src=m.sessionUrl; else if(m.storedIn==='idb'){ const blob=await idbGetVideo(m.id); if(blob) v.src=URL.createObjectURL(blob); } }catch(e){ holder.innerHTML='<div style="color:#64748b">(error al cargar video)</div>'; } return; } }
            holder.innerHTML='<div style="color:#64748b;font-size:0.7rem">(sin video)</div>';
          }
          attachBundled();
          weekDiv.appendChild(card);
        });
        pathologySection.appendChild(weekDiv);
      });
      container.appendChild(pathologySection);
    });
  }

  async function init(){
    qs('#pfName').textContent = 'Cargando paciente...';
    // Cargar ejercicios desde Supabase
    await loadExercisesFromSupabase();
    console.log('[ver_perfil] Ejercicios cargados:', window.__defaultExercises);
    
    patientRecord = await fetchPatient();
    if(!patientRecord || patientRecord.error){
      qs('#pfName').innerHTML = 'Paciente no encontrado';
      qs('#pfMeta').innerHTML = `ID: ${escapeHtml(resolvedPatientId)} Email: ${escapeHtml(paramEmail)} Error: ${escapeHtml(patientRecord && patientRecord.error || 'desconocido')}`;
      await renderAssignments();
      return;
    }
    resolvedPatientId = patientRecord.id;
    qs('#pfName').textContent = patientRecord.name || 'Paciente';
    const metaParts=[]; if(patientRecord.age) metaParts.push('Edad: '+patientRecord.age); if(patientRecord.phone) metaParts.push('Tel: '+patientRecord.phone); if(patientRecord.status) metaParts.push('Estado: '+patientRecord.status); qs('#pfMeta').textContent = metaParts.join(' · ');
    if(patientRecord.diagnosis){
      const diagEl = qs('#pfDiagnosis');
      if(diagEl) diagEl.textContent = patientRecord.diagnosis;
    }
    if(patientRecord.photo){ const av=qs('#pfAvatar'); if(av) av.src=patientRecord.photo; }
    
    // Prellenar formulario
    populateForm();
    
    await renderAssignments();
  }

  function populateForm(){
    if(!patientRecord) return;
    const nameParts = (patientRecord.name || '').split(' ');
    qs('#editFirstName').value = nameParts[0] || '';
    qs('#editLastName').value = nameParts.slice(1).join(' ') || '';
    qs('#editEmail').value = patientRecord.email || '';
    qs('#editPhone').value = patientRecord.phone || '';
    qs('#editAge').value = patientRecord.age || '';
    qs('#editDiagnosis').value = patientRecord.diagnosis || '';
  }

  function switchTab(tabName){
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if(btn) btn.classList.add('active');
    const content = document.getElementById(tabName + 'Tab');
    if(content) content.classList.add('active');
  }
  window.switchTab = switchTab;

  let isEditMode = false;
  function toggleEditMode(){
    isEditMode = !isEditMode;
    const inputs = document.querySelectorAll('#profileForm input, #profileForm select');
    const actions = qs('#formActions');
    const editBtn = qs('#editProfileBtn');
    
    inputs.forEach(inp => inp.disabled = !isEditMode);
    if(actions) actions.style.display = isEditMode ? 'flex' : 'none';
    if(editBtn) editBtn.textContent = isEditMode ? '✖️ Cancelar' : '✏️ Editar perfil';
    
    if(!isEditMode){
      populateForm(); // Restaurar valores originales
    }
  }
  window.toggleEditMode = toggleEditMode;

  function cancelEdit(){
    toggleEditMode();
  }
  window.cancelEdit = cancelEdit;

  async function saveProfile(e){
    e.preventDefault();
    if(!isEditMode || !patientRecord) return;
    
    const client = getSupabase();
    if(!client){ alert('Error: Supabase no disponible'); return; }
    
    const firstName = qs('#editFirstName').value.trim();
    const lastName = qs('#editLastName').value.trim();
    const email = qs('#editEmail').value.trim();
    const phone = qs('#editPhone').value.trim();
    const age = parseInt(qs('#editAge').value) || null;
    const diagnosis = qs('#editDiagnosis').value;
    
    try {
      const { error } = await client
        .from('patients')
        .update({
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          age: age,
          medical_history: diagnosis,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patientRecord.id);
      
      if(error) throw error;
      
      alert('✅ Perfil actualizado correctamente');
      
      // Recargar datos
      patientRecord = await fetchPatient();
      qs('#pfName').textContent = patientRecord.name || 'Paciente';
      const metaParts=[]; if(patientRecord.age) metaParts.push('Edad: '+patientRecord.age); if(patientRecord.phone) metaParts.push('Tel: '+patientRecord.phone); if(patientRecord.status) metaParts.push('Estado: '+patientRecord.status); qs('#pfMeta').textContent = metaParts.join(' · ');
      if(patientRecord.diagnosis){
        const diagEl = qs('#pfDiagnosis');
        if(diagEl) diagEl.textContent = patientRecord.diagnosis;
      }
      
      toggleEditMode();
    } catch(err) {
      console.error('[ver_perfil] Error guardando:', err);
      alert('❌ Error al guardar: ' + err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init();
    const form = qs('#profileForm');
    if(form) form.addEventListener('submit', saveProfile);
  });
})();
