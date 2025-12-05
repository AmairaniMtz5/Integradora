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

  async function waitForSupabase(timeoutMs=4000){
    const start = Date.now();
    return new Promise(resolve => {
      (function check(){
        const c = getSupabase();
        if(c){ resolve(c); return; }
        if(Date.now() - start > timeoutMs){ console.warn('[ver_perfil] Supabase no listo tras', timeoutMs, 'ms'); resolve(null); return; }
        setTimeout(check, 100);
      })();
    });
  }

  async function fetchPatient(){
    const client = getSupabase();
    if(!client){ console.warn('[ver_perfil] Supabase no inicializado'); return null; }
    let data=null, error=null;
    if(resolvedPatientId){
      console.log('[ver_perfil] Buscando paciente por ID:', resolvedPatientId);
      ({ data, error } = await client.from('patients').select('id, first_name, last_name, email, phone, age, medical_history, profile_photo_url').eq('id', resolvedPatientId).maybeSingle());
    }
    if((!data || error) && paramEmail){
      console.log('[ver_perfil] Fallback buscando paciente por email URL:', paramEmail);
      ({ data, error } = await client.from('patients').select('id, first_name, last_name, email, phone, age, medical_history, profile_photo_url').eq('email', paramEmail).maybeSingle());
    }
    if((!data || error) && resolvedPatientId && resolvedPatientId.includes('@')){
      console.log('[ver_perfil] Fallback patientId parece email:', resolvedPatientId);
      ({ data, error } = await client.from('patients').select('id, first_name, last_name, email, phone, age, medical_history, profile_photo_url').eq('email', resolvedPatientId).maybeSingle());
    }
    if(!data){
      console.warn('[ver_perfil] Paciente no encontrado', { id: resolvedPatientId, email: paramEmail, error });
      return { error: error ? error.message : 'Paciente no encontrado', id: resolvedPatientId, email: paramEmail };
    }
    console.log('[ver_perfil] Paciente encontrado:', data.email, 'foto:', data.profile_photo_url);
    return {
      id: data.id,
      name: [data.first_name, data.last_name].filter(Boolean).join(' '),
      email: data.email,
      phone: data.phone,
      age: data.age,
      photo: data.profile_photo_url || '',
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
    
    console.log('[ver_perfil] === CONSULTANDO ASIGNACIONES ===');
    console.log('[ver_perfil] PatientRecord:', patientRecord);
    
    // Preferir patient_id si lo tenemos
    if(patientRecord && patientRecord.id){
      console.log('[ver_perfil] Buscando por patient_id:', patientRecord.id);
      const { data, error } = await client.from('assigned_exercises').select('*').eq('patient_id', patientRecord.id).order('created_at',{ascending:false});
      console.log('[ver_perfil] Resultado por patient_id - data:', data, 'error:', error);
      if(!error && data) assignments.push(...data);
    }
    // Fallback por email si vacío
    if(assignments.length===0 && patientRecord && patientRecord.email){
      console.log('[ver_perfil] Buscando por patient_email:', patientRecord.email);
      const { data, error } = await client.from('assigned_exercises').select('*').eq('patient_email', patientRecord.email).order('created_at',{ascending:false});
      console.log('[ver_perfil] Resultado por patient_email - data:', data, 'error:', error);
      if(!error && data) assignments.push(...data);
    }
    
    // Migrar desde admin_assigned_exercises si no se encontró nada (solo por patient_id)
    if(assignments.length===0 && patientRecord && patientRecord.id){
      try{
        console.log('[ver_perfil] No hay asignaciones; buscando pendientes en admin_assigned_exercises...');
        const { data: pendById, error: pendErr1 } = await client
          .from('admin_assigned_exercises')
          .select('*')
          .eq('patient_id', patientRecord.id)
          .order('assigned_at', { ascending: false });
        const pend = (pendById||[]);
        console.log('[ver_perfil] Pendientes encontrados:', pend.length, 'err1:', pendErr1);
        if(pend && pend.length){
          // Insertar en assigned_exercises
          const inserts = pend.map(p => ({
            patient_id: patientRecord.id,
            patient_email: patientRecord.email || p.patient_email || null,
            exercise_id: p.exercise_id,
            pathology: p.pathology,
            assignment_week: p.assignment_week ? parseInt(p.assignment_week) : 1,
            therapist_reps: p.therapist_reps || null,
            therapist_assigned_days: p.therapist_assigned_days || null,
            therapist_notes: p.therapist_notes || null,
            created_at: p.assigned_at || new Date().toISOString()
          }));
          console.log('[ver_perfil] Migrando pendientes a assigned_exercises:', inserts.length);
          const { error: insErr } = await client.from('assigned_exercises').insert(inserts);
          if(insErr){ console.warn('[ver_perfil] Error migrando pendientes:', insErr.message); }
          else { console.log('[ver_perfil] Migración completa'); }
          // Reconsultar
          const { data: re, error: reErr } = await client.from('assigned_exercises').select('*').eq('patient_id', patientRecord.id).order('created_at',{ascending:false});
          if(!reErr && re) assignments = re;
        }
      }catch(e){ console.warn('[ver_perfil] Excepción migrando pendientes:', e); }
    }

    // Fallback final: importar legacy localStorage('assigned_exercises') para este paciente
    if(assignments.length===0 && patientRecord){
      try{
        const legacy = JSON.parse(localStorage.getItem('assigned_exercises')||'[]');
        const matches = (legacy||[]).filter(r =>
          (r.patientId && String(r.patientId)===String(patientRecord.id)) ||
          (r.patient && String(r.patient).toLowerCase()===String(patientRecord.email||'').toLowerCase())
        );
        if(matches.length){
          console.log('[ver_perfil] Importando', matches.length, 'asignaciones legacy desde localStorage');
          const inserts = matches.map(r => ({
            patient_id: patientRecord.id,
            patient_email: patientRecord.email || null,
            exercise_id: r.exerciseId,
            pathology: r.pathology,
            assignment_week: r.assignmentWeek ? parseInt(r.assignmentWeek) : 1,
            created_at: r.at || new Date().toISOString()
          }));
          const { error: insLErr } = await client.from('assigned_exercises').insert(inserts);
          if(insLErr){ console.warn('[ver_perfil] Error importando legacy:', insLErr.message); }
          else{
            const { data: re2 } = await client.from('assigned_exercises').select('*').eq('patient_id', patientRecord.id).order('created_at',{ascending:false});
            assignments = re2 || [];
          }
        }
      }catch(e){ console.warn('[ver_perfil] Excepción importando legacy:', e); }
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
    console.log('[ver_perfil] ======= RENDERIZANDO ASIGNACIONES =======');
    console.log('[ver_perfil] Total asignaciones:', assignments.length);
    if(assignments.length > 0) {
      console.log('[ver_perfil] Primera asignación completa:', assignments[0]);
    }
    if(!assignments.length){ 
      const debug = `ID: ${escapeHtml(String(patientRecord.id||''))} · Email: ${escapeHtml(String(patientRecord.email||''))}`;
      container.innerHTML = `<div style="padding:12px;color:#64748b">
        <div>No hay ejercicios asignados a este paciente.</div>
        <div style="margin-top:6px;font-size:11px;color:#94a3b8">${debug}</div>
      </div>`; 
      return; 
    }
    const defaults = readDefaults();
    console.log('[ver_perfil] Ejercicios por defecto cargados:', Object.keys(defaults).length, 'patologías');
    console.log('[ver_perfil] Patologías disponibles:', Object.keys(defaults));
    const bundled = await loadBundledVideos().catch(()=>[]);
    console.log('[ver_perfil] Videos bundled cargados:', bundled.length);

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
        // Encabezado de patología removido: no mostrar etiqueta de patología
      Object.entries(weeks).forEach(([week, items]) => {
        const weekDiv = document.createElement('div');
        weekDiv.className = 'exercise-week-group';
        items.forEach((a) => {
          const exId = a.exercise_id || a.exerciseId || '';
          let ex = null, exDesc = '';
          try{
            const lists = Object.values(defaults || {}).flat();
            ex = lists.find(e => String(e.id) === String(exId)) || null;
            exDesc = ex ? (ex.desc || ex.description || '') : '';
          }catch(_){ ex = null; exDesc = ''; }
          const baseTitle = ex && ex.name ? String(ex.name) : idToName(exId);
          const title = titleCaseEs(baseTitle);
            const desc = ex ? (ex.desc || ex.description || exDesc) : (exDesc || '');
          const card = document.createElement('div');
          card.className = 'ex-card';
          card.innerHTML = `
            <div class="ex-details">
              <div class="ex-header">
                <h4 class="ex-title">${escapeHtml(title)}</h4>
                <div class="ex-actions"></div>
              </div>
                ${desc ? `<div class="ex-subtitle">${escapeHtml(desc)}</div>` : ''}
                <div class="ex-meta" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                  ${week !== 'Sin semana' ? `<span class="badge-week">${escapeHtml(week)}</span>` : ''}
                </div>
              <div class="ex-meta">
                <div class="ex-fields">
                  <div>
                    <div class="ex-field-label">Descripción</div>
                    <div class="ex-field-value">${escapeHtml(desc||'—')}</div>
                  </div>
                </div>
              </div>
              <div class="ex-meta">
                <div class="ex-fields">
                ${a.therapist_reps ? `
                  <div>
                    <div class="ex-field-label">Reps</div>
                    <div class="ex-field-value">${escapeHtml(a.therapist_reps)}</div>
                  </div>
                ` : ''}
                ${Array.isArray(a.therapist_assigned_days) && a.therapist_assigned_days.length ? `
                  <div>
                    <div class="ex-field-label">Días</div>
                    <div class="ex-field-value">${a.therapist_assigned_days.map(d=>escapeHtml(d)).join(', ')}</div>
                  </div>
                ` : ''}
                ${a.therapist_notes ? `
                    <div class="note-card" style="grid-column:1/-1">
                      <div class="note-title">Notas</div>
                      <div class="note-text">${escapeHtml(a.therapist_notes)}</div>
                    </div>
                  ` : ''}
                </div>
              </div>
                <div class="ex-footer">
                <small style="color:#64748b;font-size:0.8rem">Asignado: ${new Date(a.created_at || a.therapist_assigned_at || Date.now()).toLocaleString()}</small>
                <button onclick="showDeleteModal('${a.id}')" class="btn btn-sm" style="background:#dc2626;color:#fff">Eliminar</button>
              </div>
            </div>
            <div class="video-col">
              <div class="video-holder" title="${escapeHtml(title)}"></div>
            </div>`;
          const holder = card.querySelector('.video-holder');
          if(ex){
            (async function attachBundled(){
              try{
                const mediaId = (ex.mediaRef && ex.mediaRef.id) ? ex.mediaRef.id : (ex.media_id || ex.video_id);
                if(ex.media && !ex.mediaRef){ const v=document.createElement('video'); v.controls=true; v.src=ex.media; v.style.maxWidth='100%'; v.style.borderRadius='6px'; holder.appendChild(v); return; }
                if(ex.mediaRef && ex.mediaRef.type === 'bundled'){
                  const found = bundled.find(b=> String(b.id) === String(ex.mediaRef.id));
                  if(found && found.path){ const v=document.createElement('video'); v.controls=true; v.style.maxWidth='100%'; v.style.borderRadius='6px'; const candidate = found.path.startsWith('videos/') ? ('../Ejercicios/'+found.path) : found.path; v.src=candidate; holder.appendChild(v); return; }
                }
                const byId = bundled.find(b=> mediaId && String(b.id)===String(mediaId));
                if(byId && byId.path){ const v=document.createElement('video'); v.controls=true; v.style.maxWidth='100%'; v.style.borderRadius='6px'; v.src = byId.path.startsWith('videos/')? ('../Ejercicios/'+byId.path): byId.path; holder.appendChild(v); return; }
                const byName = bundled.find(b=> ex.name && b.name && b.name===ex.name);
                if(byName && byName.path){ const v=document.createElement('video'); v.controls=true; v.style.maxWidth='100%'; v.style.borderRadius='6px'; v.src = byName.path.startsWith('videos/')? ('../Ejercicios/'+byName.path): byName.path; holder.appendChild(v); return; }
                if(ex.mediaRef && ex.mediaRef.type==='user'){ const metas=readUserVideosMeta(); const m=metas.find(x=> String(x.id)===String(ex.mediaRef.id)); if(m){ const v=document.createElement('video'); v.controls=true; v.style.maxWidth='100%'; v.style.borderRadius='6px'; holder.appendChild(v); try{ if(m.storedIn==='local'&&m.dataUrl) v.src=m.dataUrl; else if(m.storedIn==='session'&&m.sessionUrl) v.src=m.sessionUrl; else if(m.storedIn==='idb'){ const blob=await idbGetVideo(m.id); if(blob) v.src=URL.createObjectURL(blob); } }catch(e){ holder.innerHTML='<div style="color:#64748b">(error al cargar video)</div>'; } return; } }
                holder.innerHTML='<div style="color:#64748b;font-size:0.7rem">(sin video)</div>';
              }catch(_){ holder.innerHTML='<div style="color:#64748b;font-size:0.7rem">(sin video)</div>'; }
            })();
          } else {
            holder.innerHTML='<div style="color:#64748b;font-size:0.7rem">(sin video)</div>';
          }
          weekDiv.appendChild(card);
        });
        pathologySection.appendChild(weekDiv);
      });
      container.appendChild(pathologySection);
    });
  }

  async function init(){
    try{
      console.log('[ver_perfil] URL params:', { patientId: paramPatientId, email: paramEmail });
      qs('#pfName').textContent = 'Cargando paciente...';
      // Esperar a Supabase
      const client = await waitForSupabase();
      if(!client){ console.warn('[ver_perfil] Supabase no disponible (timeout). Continuando con UI por defecto.'); }
      // Cargar ejercicios desde Supabase para metadata
      await loadExercisesFromSupabase();
      console.log('[ver_perfil] Ejercicios cargados:', window.__defaultExercises);
      // Buscar paciente
      patientRecord = await fetchPatient();
    }catch(e){ console.error('[ver_perfil] Error en init antes de render:', e); }
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

  // (Eliminado) Bloque de UI para asignación dentro de Ver Perfil.
  // Esta vista es solo lectura; la asignación se hace en "Ejercicios — Patologías".

  function titleCaseEs(text){
    try{
      const small = new Set(['de','del','la','el','los','las','y','o','u','a','en','con','para','por','al']);
      const words = String(text||'').toLowerCase().split(/\s+/).filter(Boolean);
      return words.map((w,i)=>{
        if(i>0 && small.has(w)) return w;
        return w.charAt(0).toUpperCase()+w.slice(1);
      }).join(' ');
    }catch(_){ return String(text||''); }
  }

  function idToName(exerciseId){
    try{
      if(!exerciseId) return '';
      let s = String(exerciseId).trim();
      // normalizar separadores
      s = s.replace(/[._]/g,'-').replace(/--+/g,'-');
      // dividir por '-'
      let parts = s.split('-').filter(Boolean);
      // quitar prefijo de patología si parece presente
      const known = new Set(['hernia','lumbalgia','escoliosis','espondilolisis','espondilólisis']);
      if(parts.length>1 && known.has(parts[0].toLowerCase())){
        parts = parts.slice(1);
      }
      const out = parts.join(' ').replace(/\s+/g,' ').trim();
      return out || String(exerciseId);
    }catch(_){ return String(exerciseId||''); }
  }

  function escapeHtml(text){
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', () => {
    init();
    const form = qs('#profileForm');
    if(form) form.addEventListener('submit', saveProfile);
  });
})();
