// admin-pacientes.js
// Render patients dynamically for the admin Pacientes page and support filtering
(function(){
  function readTherapists(){ return JSON.parse(localStorage.getItem('therapists')||'[]'); }
  // therapist_patients might be stored as a map { therapistId: [patients] } or as a flat array.
  function readPatients(){
    const raw = JSON.parse(localStorage.getItem('therapist_patients')||'{}');
    if(Array.isArray(raw)) return raw; // already an array of patient objects
    // otherwise it's an object mapping therapistId -> array
    const arr = [];
    Object.keys(raw || {}).forEach(tid => {
      const list = raw[tid] || [];
      (list||[]).forEach(p => {
        // ensure patient object knows assigned therapist
        const copy = Object.assign({}, p);
        copy.assignedTherapist = copy.assignedTherapist || tid;
        arr.push(copy);
      })
    })
    return arr;
  }
  
  // Cargar pacientes desde Supabase con fotos
  async function loadPatientsFromSupabase(){
    try {
      const client = window.supabaseServiceClient || window.supabaseClient;
      if(!client){ console.warn('[pacientes] Supabase no disponible'); return []; }
      
      const { data: patients, error } = await client
        .from('patients')
        .select('id, first_name, last_name, email, phone, age, medical_history, therapist_id, profile_photo_url, created_at, updated_at');
      
      if(error){ console.warn('[pacientes] Error cargando:', error.message); return []; }
      
      // Para cada paciente, usar photo desde patients.profile_photo_url
      const patientsWithPhotos = await Promise.all((patients||[]).map(async (p) => {
        let photo_url = p.profile_photo_url || null;
        let full_name = '';
        let therapistName = '';
        let therapistEmail = null;
        
        // Solo buscar en users si no hay foto en patients
        if(!photo_url) {
          try {
            const { data: user } = await client.from('users').select('photo_url, full_name').eq('email', p.email).maybeSingle();
            photo_url = user && user.photo_url ? user.photo_url : null;
            full_name = user && user.full_name ? user.full_name : '';
          } catch(e){ console.warn('[pacientes] Error obteniendo photo_url:', e.message); }
        }

        // Obtener nombre del terapeuta por therapist_id si está presente
        try {
          if(p.therapist_id){
            const { data: t } = await client.from('therapists').select('first_name, last_name').eq('id', p.therapist_id).maybeSingle();
            therapistName = t ? ((t.first_name||'') + (t.last_name? (' ' + t.last_name):'')) : '';
            if(!therapistName){
              // Fallback: users con role=therapist y matching id
              const { data: tu } = await client.from('users').select('full_name').eq('id', p.therapist_id).maybeSingle();
              therapistName = tu && tu.full_name ? tu.full_name : '';
            }
          } else if(p.assigned_therapist) {
            // Fallback: si hay correo o nombre en assigned_therapist, intentar resolver por email
            therapistEmail = p.assigned_therapist;
            try {
              const { data: t2 } = await client.from('therapists').select('first_name, last_name, email').eq('email', therapistEmail).maybeSingle();
              if(t2) therapistName = (t2.first_name||'') + (t2.last_name? (' ' + t2.last_name):'');
              if(!therapistName){
                const { data: tu2 } = await client.from('users').select('full_name').eq('email', therapistEmail).maybeSingle();
                therapistName = tu2 && tu2.full_name ? tu2.full_name : '';
              }
            } catch(e){ /* ignore */ }
          }
        } catch(e){ console.warn('[pacientes] Error obteniendo terapeuta asignado:', e.message); }
        
        const combinedName = ((p.first_name || '') + (p.last_name ? ' ' + p.last_name : '')).trim();
        // Fallback adicional: si no hay foto/nombre, intentar desde cache local
        if(!photo_url || !combinedName){
          try{
            const cache = JSON.parse(localStorage.getItem('therapist_patients')||'[]');
            const flat = Array.isArray(cache) ? cache : Object.keys(cache||{}).reduce((acc,k)=> acc.concat((cache[k]||[])), []);
            const byEmail = (flat||[]).find(x=> String(x.email||x.correo||'').toLowerCase()===String(p.email||'').toLowerCase());
            if(byEmail){
              if(!photo_url && byEmail.photo) photo_url = byEmail.photo;
              if(!full_name && byEmail.name) full_name = byEmail.name;
            }
          }catch(_){ /* ignore */ }
        }
        return {
          id: p.id || p.email,
          name: combinedName || full_name || (p.email || ''),
          email: p.email || '',
          phone: p.phone || '',
          age: p.age || '',
          photo: photo_url || '',
          status: 'Activo',
          diagnosis: p.medical_history || '',
          assignedTherapist: p.therapist_id || therapistEmail || null,
          assignedTherapistName: therapistName || ''
        };
      }));
      
      console.log('[pacientes] Cargados desde Supabase:', patientsWithPhotos.length);
      return patientsWithPhotos;
    } catch(e){
      console.warn('[pacientes] loadPatientsFromSupabase falló:', e.message);
      return [];
    }
  }
  
  const container = document.getElementById('patientsContainer');
  if(!container) return;

  const params = new URLSearchParams(window.location.search);
  const filter = params.get('filter');
  const therapistParam = params.get('therapist') || null;

  let patients = readPatients();
  let therapists = readTherapists();

  async function loadTherapistsFromSupabase(){
    try{
      const client = window.supabaseServiceClient || window.supabaseClient;
      if(!client) return [];
      // Usar exclusivamente users.role='therapist' para asegurar UUID válido
      const { data: users, error } = await client.from('users').select('id, full_name, email, role').eq('role','therapist');
      if(error){ console.warn('[pacientes] cargar terapeutas (users) falló:', error.message); return []; }
      const list = (users||[]).map(u=> ({ id: u.id, name: u.full_name || u.email, email: u.email }));
      console.log('[pacientes] terapeutas cargados (users.role=therapist):', list.length);
      return list;
    }catch(e){ console.warn('[pacientes] loadTherapistsFromSupabase', e.message); return []; }
  }
  
  function getTherapistName(id){ 
    if(!id) return '--'; 
    const t = therapists.find(x=> String(x.id)===String(id)); 
    return t? t.name : '--'; 
  }
  
  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function makeCard(p){
    const div = document.createElement('div');
    div.className = 'patient-card';
    const statusClass = (p.status && p.status.toLowerCase().includes('activo')) ? 'status-active' : (p.status? 'status-followup':'status-inactive');
    // use patient photo if available (data URL or stored path), otherwise fallback to admin avatar
    const photoSrc = p && p.photo ? p.photo : '../Dashboard/avatar.png';
    div.innerHTML = `
      <div class="patient-header" style="display:flex;gap:12px;align-items:center">
        <div class="patient-avatar" style="flex:0 0 auto">
          <img src="${escapeHtml(photoSrc)}" alt="Foto paciente" style="width:64px;height:64px;border-radius:8px;object-fit:cover;" />
        </div>
        <div class="patient-info" style="flex:1">
          <h3>${escapeHtml(p.name)}</h3>
          <div class="patient-specialty">${escapeHtml(p.diagnosis||'--')}</div>
        </div>
      </div>
      <div class="patient-details">
        <p><strong>Terapeuta asignado:</strong> ${escapeHtml(p.assignedTherapistName || getTherapistName(p.assignedTherapist))}</p>
        <p><strong>Correo:</strong> ${escapeHtml(p.email||p.correo||'--')}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(p.phone||'--')}</p>
        <p><strong>Estado:</strong> <span class="patient-status ${statusClass}">${escapeHtml(p.status||'--')}</span></p>
      </div>
      <div class="patient-actions">
        <button class="btn btn-primary" onclick="window.location.href='../ver perfil/ver_perfil.html?patientId=${encodeURIComponent(p.id)}&email=${encodeURIComponent(p.email||p.correo||'')}'">Ver perfil</button>
        <button class="btn btn-edit" onclick="editPatient('${encodeURIComponent(p.id)}')">Editar</button>
        <button class="btn btn-danger" onclick="deletePatient(this, '${encodeURIComponent(p.id)}')">Eliminar</button>
      </div>`;
    return div;
  }

  function renderForSelection(){
    console.log('[pacientes] renderForSelection llamado, patients.length:', patients.length);
    let list = patients.slice();
    if(filter==='active') list = list.filter(p=> p.status && p.status.toLowerCase().includes('activo'));
    const selected = (therapistParam||null);
    if(selected) list = list.filter(p=> p.assignedTherapist === selected);

    console.log('[pacientes] Lista filtrada:', list.length, 'container:', container);
    container.innerHTML = '';
    if(list.length===0){ container.innerHTML = '<div class="empty-state">No hay pacientes que coincidan con el filtro.</div>'; return; }
    list.forEach(p=> container.appendChild(makeCard(p)));
    console.log('[pacientes] Cards renderizadas:', container.children.length);
  }

  // Search functionality
  const searchInput = document.getElementById('searchInput');
  if(searchInput){
    searchInput.addEventListener('input', function(){
      const query = this.value.toLowerCase().trim();
      let list = patients.slice();
      if(filter==='active') list = list.filter(p=> p.status && p.status.toLowerCase().includes('activo'));
      const selected = (therapistParam||null);
      if(selected) list = list.filter(p=> p.assignedTherapist === selected);
      
      if(query){
        list = list.filter(p=> {
          const name = (p.name||'').toLowerCase();
          const therapist = getTherapistName(p.assignedTherapist).toLowerCase();
          const diagnosis = (p.diagnosis||p.condition||'').toLowerCase();
          const status = (p.status||'').toLowerCase();
          return name.includes(query) || therapist.includes(query) || diagnosis.includes(query) || status.includes(query);
        });
      }
      
      container.innerHTML = '';
      if(list.length===0){ container.innerHTML = '<div class="empty-state">No se encontraron pacientes.</div>'; return; }
      list.forEach(p=> container.appendChild(makeCard(p)));
    });
  }

  // Cargar desde Supabase y combinar con localStorage
  async function initPatients(){
    console.log('[pacientes] initPatients iniciado');
    const supabasePatients = await loadPatientsFromSupabase();
    const supabaseTherapists = await loadTherapistsFromSupabase();
    console.log('[pacientes] Supabase retornó', supabasePatients.length, 'pacientes');
    if(supabaseTherapists.length>0){ therapists = supabaseTherapists; }
    if(supabasePatients.length > 0){
      // Priorizar SIEMPRE los datos de Supabase y agregar los de localStorage que no estén
      const emailSet = new Set(supabasePatients.map(p => (p.email||'').toLowerCase()));
      const localOnly = patients.filter(p => !emailSet.has((p.email||p.correo||'').toLowerCase()));
      patients = [...supabasePatients, ...localOnly];
    }
    console.log('[pacientes] Total después de combinar:', patients.length);
    // Intento de migración: si therapist_id no es UUID válido, intentar resolver por email almacenado
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const client = window.supabaseServiceClient || window.supabaseClient;
    if(client){
      for(const p of patients){
        if(p.assignedTherapist && !uuidRegex.test(p.assignedTherapist)){
          // Buscar terapeuta por email y actualizar therapist_id
          try{
            const { data: userTher } = await client.from('users').select('id').eq('email', p.assignedTherapist).eq('role','therapist').maybeSingle();
            if(userTher && userTher.id){
              await client.from('patients').update({ therapist_id: userTher.id }).eq('email', p.email);
              p.assignedTherapist = userTher.id;
              console.log('[pacientes] Migrado therapist_id para', p.email);
            }
          }catch(e){ /* ignore */ }
        }
      }
    }
    try{ window.__therapistPatients = patients.slice(); }catch(e){}
    renderForSelection();
  }
  
  // update when patients/therapists change
  function refreshPatients(){ 
    patients = readPatients(); 
    therapists = readTherapists(); 
    initPatients(); // Recargar desde Supabase también
  }
  window.addEventListener('storage', function(){ try{ refreshPatients(); }catch(e){} });
  window.addEventListener('patients:updated', function(){ try{ refreshPatients(); }catch(e){} });

  // also keep a window-level cache for other modules
  try{ window.__therapistPatients = patients.slice(); }catch(e){}
  
  // Inicializar carga de pacientes
  initPatients();
  // update cache when changes arrive
  async function refreshAndCache(){
    // Recalcular la lista desde Supabase sin parpadeo doble
    try{
      await initPatients();
    }catch(e){
      console.warn('[pacientes] refreshAndCache fallo:', e);
      // Fallback mínimo
      patients = readPatients();
      try{ window.__therapistPatients = patients.slice(); }catch(_){ }
      renderForSelection();
    }
  }
  window.addEventListener('patients:updated', function(){ try{ refreshAndCache(); }catch(e){} });

  // --- Edit / Delete support ---
  function writePatientsRaw(raw){
    try{ localStorage.setItem('therapist_patients', JSON.stringify(raw)); }catch(e){ console.warn('writePatientsRaw failed', e); }
    try{ window.dispatchEvent(new Event('patients:updated')); }catch(e){}
  }
  function filterOut(raw, id){
    if(Array.isArray(raw)) return raw.filter(p=> String(p.id)!==String(id));
    if(raw && typeof raw==='object'){
      const out={}; Object.keys(raw).forEach(tid=>{ out[tid] = (raw[tid]||[]).filter(p=> String(p.id)!==String(id)); }); return out;
    }
    return raw;
  }
  async function deletePatient(btnOrId, maybeId){
    const btn = (btnOrId && btnOrId.tagName) ? btnOrId : null;
    let id = btn ? maybeId : btnOrId;
    id = decodeURIComponent(id);
    if(btn){ btn.disabled = true; const old = btn.textContent; btn.dataset.oldText = old; btn.textContent = 'Eliminando…'; }
    
    // Get patient name for confirmation
    let raw; try{ raw = JSON.parse(localStorage.getItem('therapist_patients')||'[]'); }catch(e){ raw = []; }
    const flat = Array.isArray(raw) ? raw : Object.keys(raw).reduce((acc,k)=> acc.concat((raw[k]||[]).map(p=>{ if(!p.assignedTherapist) p.assignedTherapist = k; return p; })), []);
    const patient = flat.find(p=> String(p.id)===String(id));
    const patientName = patient ? patient.name : 'este paciente';
    const patientEmail = patient ? (patient.email || patient.correo || '') : '';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
    
    // Show custom confirmation modal
    showDeleteConfirmation(patientName, async function(){
      try{
        // Eliminar de Supabase primero
        const client = window.supabaseServiceClient || window.supabaseClient;
        if(client){
          console.log('[admin-pacientes] Eliminando paciente de Supabase:', { id, patientEmail, isUuid });
          let error;
          let patientUserId = null;
          
          // Primero obtener el user_id del paciente para eliminar de Auth
          if(isUuid){
            const { data: patientData } = await client.from('patients').select('user_id').eq('id', id).maybeSingle();
            patientUserId = patientData?.user_id;
            ({ error } = await client.from('patients').delete().eq('id', id));
          } else if(patientEmail){
            const { data: patientData } = await client.from('patients').select('user_id').eq('email', patientEmail).maybeSingle();
            patientUserId = patientData?.user_id;
            ({ error } = await client.from('patients').delete().eq('email', patientEmail));
          } else {
            // Intento de búsqueda previa por nombre/email para encontrar UUID
            const { data: found, error: findErr } = await client.from('patients').select('id, user_id').eq('id', id).limit(1);
            if(findErr){ error = findErr; }
            else if(found && found.length){
              patientUserId = found[0].user_id;
              ({ error } = await client.from('patients').delete().eq('id', found[0].id));
            } else {
              console.warn('[admin-pacientes] No se pudo determinar identificador para borrar');
              error = null;
            }
          }
          
          if(error){
            console.error('[admin-pacientes] Error al eliminar de Supabase:', error);
            alert('Error al eliminar el paciente: ' + error.message);
            if(btn){ btn.disabled = false; btn.textContent = btn.dataset.oldText || 'Eliminar'; }
            return;
          }
          
          // Eliminar usuario de Auth si existe user_id
          if(patientUserId){
            const serviceClient = window.supabaseServiceClient;
            if(serviceClient && serviceClient.auth && serviceClient.auth.admin){
              try {
                console.log('[admin-pacientes] Eliminando usuario de Auth:', patientUserId);
                const { error: authError } = await serviceClient.auth.admin.deleteUser(patientUserId);
                if(authError){
                  console.error('[admin-pacientes] Error al eliminar usuario de Auth:', authError);
                  alert('Advertencia: El paciente se eliminó pero hubo un error al eliminar su cuenta de acceso: ' + authError.message);
                } else {
                  console.log('[admin-pacientes] ✅ Usuario eliminado de Auth correctamente');
                }
              } catch(authErr) {
                console.error('[admin-pacientes] Excepción al eliminar de Auth:', authErr);
                alert('Advertencia: No se pudo eliminar la cuenta de acceso del usuario.');
              }
            } else {
              console.warn('[admin-pacientes] Service client no disponible para eliminar de Auth');
              alert('Advertencia: El paciente se eliminó pero no se pudo eliminar su cuenta de acceso. Necesitas configurar service_role_key.');
            }
          }
          
          // También eliminar de la tabla users si existe
          if(patientEmail){
            try {
              await client.from('users').delete().eq('email', patientEmail);
              console.log('[admin-pacientes] Usuario eliminado de tabla users');
            } catch(usersErr) {
              console.warn('[admin-pacientes] Error al eliminar de users:', usersErr.message);
            }
          }
        }
        
        // Eliminar del localStorage (por id o por email)
        let updated = raw;
        try{
          const removeBy = (arrOrMap)=>{
            if(Array.isArray(arrOrMap)){
              return arrOrMap.filter(p=> String(p.id)!==String(id) && (!patientEmail || String((p.email||p.correo||'')).toLowerCase() !== String(patientEmail).toLowerCase()));
            }
            if(arrOrMap && typeof arrOrMap==='object'){
              const out={};
              Object.keys(arrOrMap).forEach(tid=>{
                out[tid] = (arrOrMap[tid]||[]).filter(p=> String(p.id)!==String(id) && (!patientEmail || String((p.email||p.correo||'')).toLowerCase() !== String(patientEmail).toLowerCase()));
              });
              return out;
            }
            return arrOrMap;
          };
          updated = removeBy(raw);
        }catch(_){ updated = filterOut(raw, id); }
        writePatientsRaw(updated);
        // Optimista: quitar card del DOM inmediatamente
        if(btn){ const card = btn.closest('.patient-card'); if(card) card.remove(); }
        await refreshAndCache();
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
          z-index: 10000;
          font-weight: 500;
          animation: slideInRight 0.3s ease;
        `;
        successMsg.textContent = '✓ Paciente eliminado correctamente';
        document.body.appendChild(successMsg);
        setTimeout(() => {
          successMsg.style.animation = 'slideOutRight 0.3s ease';
          setTimeout(() => successMsg.remove(), 300);
        }, 3000);
      }catch(e){
        console.error('[admin-pacientes] Exception al eliminar:', e);
        alert('Error al eliminar el paciente');
      } finally {
        if(btn){ btn.disabled = false; btn.textContent = btn.dataset.oldText || 'Eliminar'; }
      }
    });
  }
  window.deletePatient = deletePatient;

  function showDeleteConfirmation(patientName, onConfirm){
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '10000';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.maxWidth = '450px';
    modal.innerHTML = `
      <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
        <h2 style="margin: 0; font-size: 1.3rem;">⚠️ Confirmar eliminación</h2>
      </div>
      <div class="modal-body" style="padding: 30px; text-align: center;">
        <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.8;">🗑️</div>
        <p style="font-size: 1.1rem; color: #374151; margin-bottom: 10px; font-weight: 500;">
          ¿Estás seguro de que deseas eliminar a:
        </p>
        <p style="font-size: 1.3rem; color: #0A1B4F; font-weight: 600; margin-bottom: 20px;">
          ${escapeHtml(patientName)}
        </p>
        <p style="color: #ef4444; font-size: 0.95rem; background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; margin-top: 15px;">
          ⚠️ Esta acción no se puede deshacer
        </p>
      </div>
      <div class="modal-footer" style="padding: 20px 30px; gap: 12px;">
        <button class="btn btn-cancel" id="cancelDelete" style="flex: 1; padding: 12px;">
          Cancelar
        </button>
        <button class="btn btn-danger" id="confirmDelete" style="flex: 1; padding: 12px;">
          Sí, eliminar
        </button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Event listeners
    document.getElementById('cancelDelete').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) overlay.remove();
    });
    document.getElementById('confirmDelete').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
  }

  function findAndUpdate(raw, id, updater){
    if(Array.isArray(raw)) return raw.map(p=> String(p.id)===String(id)? updater(p): p);
    if(raw && typeof raw==='object'){
      const out={}; Object.keys(raw).forEach(tid=>{ out[tid] = (raw[tid]||[]).map(p=> String(p.id)===String(id)? updater(p): p); }); return out;
    }
    return raw;
  }
  async function editPatient(id){
    id = decodeURIComponent(id);
    // Buscar en la variable patients que ya incluye datos de Supabase
    const current = patients.find(p=> String(p.id)===String(id) || String(p.email)===String(id));
    if(!current){ alert('Paciente no encontrado'); return; }
    
    // Populate therapist select
    const therapistSelect = document.getElementById('editTherapist');
    if(therapistSelect){
      // Si la lista está vacía, cargar desde Supabase y esperar
      if(!therapists || therapists.length===0){
        try {
          const list = await loadTherapistsFromSupabase();
          therapists = list;
        } catch(e){ console.warn('[pacientes] no se pudo cargar terapeutas', e.message); }
      }
      therapistSelect.innerHTML = '<option value="">Seleccionar terapeuta</option>';
      (therapists||[]).forEach(t=> {
        const opt = document.createElement('option');
        opt.value = t.id || ''; // UUID si existe, si no vacío
        opt.textContent = t.name;
        opt.dataset.email = t.email || '';
        if(String(t.id) === String(current.assignedTherapist)) opt.selected = true;
        therapistSelect.appendChild(opt);
      });
    }
    
    // Populate form with current values
    document.getElementById('editPatientId').value = id;
    document.getElementById('editName').value = current.name || '';
    document.getElementById('editAge').value = current.age || '';
    document.getElementById('editEmail').value = current.email || current.correo || '';
    document.getElementById('editPhone').value = current.phone || '';
    const diagSelect = document.getElementById('editDiagnosis');
    if(diagSelect){
      const val = current.diagnosis || current.condition || '';
      // si no está en la lista, agregarlo como opción temporal
      const exists = Array.from(diagSelect.options).some(o=> o.text.trim().toLowerCase()===String(val).trim().toLowerCase());
      if(val && !exists){
        const opt = document.createElement('option');
        opt.textContent = val;
        opt.value = val;
        diagSelect.appendChild(opt);
      }
      diagSelect.value = val || '';
    }
    document.getElementById('editStatus').value = current.status || 'Activo';
    document.getElementById('editNotes').value = current.notes || '';
    
    // Set photo preview
    const photoPreview = document.getElementById('editPhotoPreview');
    if(photoPreview){
      photoPreview.src = current.photo || '../Dashboard/avatar.png';
    }
    
    // Show modal
    document.getElementById('editModal').classList.add('active');
  }
  window.editPatient = editPatient;

  // Handle photo upload
  const photoInput = document.getElementById('editPhotoInput');
  if(photoInput){
    photoInput.addEventListener('change', function(e){
      const file = e.target.files[0];
      if(!file) return;
      
      // Validate file size (max 5MB)
      if(file.size > 5 * 1024 * 1024){
        alert('La imagen es demasiado grande. El tamaño máximo es 5MB.');
        this.value = '';
        return;
      }
      
      // Validate file type
      if(!file.type.startsWith('image/')){
        alert('Por favor selecciona un archivo de imagen válido.');
        this.value = '';
        return;
      }
      
      // Read and preview image
      const reader = new FileReader();
      reader.onload = function(event){
        const photoPreview = document.getElementById('editPhotoPreview');
        if(photoPreview){
          photoPreview.src = event.target.result;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function removePatientPhoto(){
    const photoPreview = document.getElementById('editPhotoPreview');
    const photoInput = document.getElementById('editPhotoInput');
    if(photoPreview){
      photoPreview.src = '../Dashboard/avatar.png';
    }
    if(photoInput){
      photoInput.value = '';
    }
  }
  window.removePatientPhoto = removePatientPhoto;

  function closeEditModal(){
    document.getElementById('editModal').classList.remove('active');
  }
  window.closeEditModal = closeEditModal;

  async function savePatientChanges(){
    const id = document.getElementById('editPatientId').value;
    const name = document.getElementById('editName').value.trim();
    const age = document.getElementById('editAge').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const diagnosis = document.getElementById('editDiagnosis').value.trim();
    const status = document.getElementById('editStatus').value;
    const assignedTherapist = document.getElementById('editTherapist').value;
    const notes = document.getElementById('editNotes').value.trim();
    const photo = document.getElementById('editPhotoPreview').src;
    const photoInput = document.getElementById('editPhotoInput');
    const file = photoInput && photoInput.files && photoInput.files[0];
    
    if(!name || !age || !email || !phone || !diagnosis || !assignedTherapist){
      alert('Por favor completa todos los campos obligatorios');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      alert('Por favor ingresa un correo electrónico válido');
      return;
    }
    
    // Validate age
    if(age < 1 || age > 120){
      alert('Por favor ingresa una edad válida (1-120)');
      return;
    }
    
    // Actualizar Supabase
    let photoUrl = photo;
    try {
      const client = window.supabaseServiceClient || window.supabaseClient;
      if(client){
        // Subir foto si se seleccionó una nueva
        if(file && window.SupabaseStorage){
          // Intentar subir usando el user.id si existe; si no, usar el id del paciente
          let ownerId = null;
          try {
            const { data: user } = await client.from('users').select('id').eq('email', email).maybeSingle();
            ownerId = (user && user.id) ? user.id : (id || null);
          } catch(_) { ownerId = id || null; }
          if(ownerId){
            const up = await window.SupabaseStorage.uploadProfilePhoto(ownerId, file);
            if(up.success && up.publicUrl){
              photoUrl = up.publicUrl;
              // actualizar tabla users si tenemos userId
              if(ownerId && (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(ownerId)){
                await window.SupabaseAuth.updateUserProfile(ownerId, { photo_url: up.publicUrl });
              }
              console.log('[paciente] Foto subida a Storage:', up.publicUrl);
            } else if(!up.success) {
              console.warn('[paciente] Fallo al subir foto:', up.error);
            }
          } else {
            console.warn('[paciente] No se pudo determinar ownerId para la foto; se continuará sin subir');
          }
        }
        
        // Resolver therapist_id válido (UUID) para evitar FK 409
        let resolvedTherapistId = null;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if(assignedTherapist && uuidRegex.test(assignedTherapist)){
          resolvedTherapistId = assignedTherapist;
        } else if(assignedTherapist){
          // Si vino un email u otro identificador, buscar UUID SOLO en therapists
          try{
            const { data: t1 } = await client.from('therapists').select('id').eq('email', assignedTherapist).maybeSingle();
            if(t1 && t1.id) resolvedTherapistId = t1.id;
          }catch(e){ console.warn('Resolviendo therapist_id por email falló', e.message); }
        } else {
          // assignedTherapist está vacío, intentar resolver desde la opción seleccionada por su data-email
          const sel = document.getElementById('editTherapist');
          const opt = sel ? sel.options[sel.selectedIndex] : null;
          const emailFromOpt = opt ? (opt.dataset.email || '') : '';
          if(emailFromOpt){
            try{
              const { data: t2 } = await client.from('therapists').select('id').eq('email', emailFromOpt).maybeSingle();
              if(t2 && t2.id) resolvedTherapistId = t2.id;
            }catch(e){ console.warn('Resolviendo therapist_id desde opción falló', e.message); }
          }
        }

        if(!resolvedTherapistId && assignedTherapist){
          console.warn('[paciente] therapist_id no resuelto. Evitando setear FK inválida.');
        }

        // Si no se resolvió, no setear therapist_id para evitar 409; se puede actualizar luego
        const therapistUpdate = resolvedTherapistId ? { therapist_id: resolvedTherapistId } : {};

        // Actualizar tabla patients
        const nameParts = (name || '').split(' ');
        // Actualizar tabla patients con todos los campos relevantes por id
        const updates = Object.assign({
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          email: email || '',
          phone: phone || '',
          age: age || '',
          medical_history: diagnosis || null,
          profile_photo_url: photoUrl || '',
          updated_at: new Date().toISOString()
        }, therapistUpdate);
        const { error } = await client.from('patients').update(updates).eq('id', id);
        if(error) console.warn('patients update falló:', error.message);
        else console.log('[paciente] Registro actualizado en Supabase');

        // Actualizar foto y nombre en tabla users si corresponde
        // Buscar usuario por email antes de actualizar tabla users
        if(email){
          const { data: userData } = await client.from('users').select('id').eq('email', email).maybeSingle();
          if(userData && userData.id){
            const userUpdates = { full_name: name };
            if(photoUrl) userUpdates.photo_url = photoUrl;
            await client.from('users').update(userUpdates).eq('id', userData.id);
            console.log('[paciente] Tabla users actualizada:', userUpdates);
          }
        }

        // Actualizar variable local patients
        const idx = patients.findIndex(p => String(p.id)===String(id) || String(p.email)===String(email));
        if(idx !== -1){
          patients[idx] = Object.assign({}, patients[idx], {
            name,
            age,
            email,
            phone,
            diagnosis,
            status,
            assignedTherapist,
            notes,
            photo: photoUrl,
            correo: email,
            condition: diagnosis
          });
        }
      }
    } catch(e){
      console.warn('Error actualizando paciente en Supabase:', e.message);
    }
    
    // Actualizar localStorage para compatibilidad
    let raw; try{ raw = JSON.parse(localStorage.getItem('therapist_patients')||'[]'); }catch(e){ raw = []; }
    const updatedRaw = findAndUpdate(raw, id, (p)=> Object.assign({}, p, {
      name, age, email, phone, diagnosis, status, assignedTherapist, notes, photo: photoUrl,
      correo: email,
      condition: diagnosis
    }));
    writePatientsRaw(updatedRaw);
    
    // Recargar lista
    await initPatients();
    closeEditModal();
    
    // Disparar evento global para que otras vistas se actualicen
    try {
      window.dispatchEvent(new CustomEvent('patient:updated', { detail: { id, email, name, age, photo: photoUrl, diagnosis, status } }));
    } catch(e) { console.warn('[paciente] Error disparando evento patient:updated', e); }
    
    // Show success message with animation
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 20px rgba(34, 197, 94, 0.4);
      z-index: 10000;
      font-weight: 500;
      animation: slideInRight 0.3s ease;
    `;
    successMsg.textContent = '✓ Paciente actualizado correctamente';
    document.body.appendChild(successMsg);
    setTimeout(() => {
      successMsg.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => successMsg.remove(), 300);
    }, 3000);
  }
  window.savePatientChanges = savePatientChanges;

  // Close modal when clicking outside
  document.getElementById('editModal').addEventListener('click', function(e){
    if(e.target === this) closeEditModal();
  });
})();
