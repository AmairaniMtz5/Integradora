// pacientes-por-terapeuta.js
const DEFAULT_PATIENT_AVATAR = 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&h=200&fit=crop&crop=face';

(function(){
  const container = document.getElementById('patientsContainer');
  const therapistInfo = document.getElementById('therapistInfo');
  if(!container) return;

  const params = new URLSearchParams(window.location.search);
  const therapistId = params.get('therapist');
  const statusFilter = params.get('filter');

  function normalizeId(value){
    if(!value) return '';
    if(typeof value === 'object'){
      value = value._id || value.id || value.therapistId || value.terapeutaAsignado || value.assignedTherapist || value.assigned || '';
    }
    return String(value || '').toLowerCase().replace(/^t/, '').trim();
  }

  function readPatients(){
    try{
      const raw = JSON.parse(localStorage.getItem('therapist_patients') || '{}');
      if(Array.isArray(raw)) return raw.slice();
      return Object.keys(raw||{}).reduce((acc, key) => {
        const list = raw[key] || [];
        list.forEach(p => {
          const patient = Object.assign({}, p);
          if(!patient.assignedTherapist) patient.assignedTherapist = key;
          acc.push(patient);
        });
        return acc;
      }, []);
    }catch(e){
      console.warn('pacientes-por-terapeuta: no se pudo leer pacientes', e);
      return [];
    }
  }

  async function loadTherapistPatientsFromSupabase(){
    try{
      const client = window.supabaseServiceClient || window.supabaseClient;
      if(!client){
        console.warn('[pacientes-por-terapeuta] No hay cliente Supabase');
        return [];
      }
      if(!therapistId){
        console.warn('[pacientes-por-terapeuta] No hay therapistId en URL');
        return [];
      }
      console.log('[pacientes-por-terapeuta] Cargando pacientes para therapist:', therapistId);
      const { data, error } = await client
        .from('patients')
        .select('id, first_name, last_name, email, phone, medical_history, therapist_id, age, created_at, profile_photo_url')
        .eq('therapist_id', therapistId)
        .order('created_at', { ascending: false });
      
      if(error){
        console.error('[pacientes-por-terapeuta] Error:', error);
        return [];
      }
      console.log('[pacientes-por-terapeuta] Pacientes cargados:', (data||[]).length);
      return (data||[]).map(p=>{
        console.log('[pacientes-por-terapeuta] Paciente:', p.email, 'foto:', p.profile_photo_url);
        return {
          id: p.id || p.email,
          name: [p.first_name||'', p.last_name||''].join(' ').trim(),
          email: p.email||'',
          phone: p.phone||'',
          age: (p.age!=null ? p.age : undefined),
          diagnosis: p.medical_history||'',
          assignedTherapist: p.therapist_id||'',
          status: 'Activo',
          photo: p.profile_photo_url || ''
        };
      });
    }catch(e){
      console.error('[pacientes-por-terapeuta] Exception:', e);
      return [];
    }
  }

  function loadTherapistPatients(){
    if(Array.isArray(window.__therapistPatients)) return window.__therapistPatients.slice();
    return readPatients();
  }

  function matchesTherapist(patient){
    if(!therapistId) return true;
    const targetNorm = normalizeId(therapistId);
    const candidate = normalizeId(patient.assignedTherapist);
    return targetNorm && candidate && candidate === targetNorm;
  }

  function isActive(patient){
    return patient.status && patient.status.toLowerCase().includes('activo');
  }

  function getPatients(){
    const patients = readPatients();
    return patients.filter(p => matchesTherapist(p) && (!statusFilter || statusFilter !== 'active' || isActive(p)));
  }

  function escapeHtml(text){ return String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function getTherapistName(id){
    try{
      const therapists = JSON.parse(localStorage.getItem('therapists')||'[]');
      const match = therapists.find(t => normalizeId(t.id) === normalizeId(id));
      return match ? match.name : (id || '--');
    }catch(e){
      return id || '--';
    }
  }

  function makeCard(p){
    const div = document.createElement('article');
    div.className = 'patient-card';
    const statusClass = (p.status && p.status.toLowerCase().includes('activo')) ? 'status-active' : (p.status? 'status-followup' : 'status-inactive');
    const photoSrc = p.photo || DEFAULT_PATIENT_AVATAR;
    const emailValue = (p.email || p.correo || '').trim();
    console.log('[pacientes-por-terapeuta] makeCard - BEFORE ageValue calculation', {name: p.name, age: p.age, typeof_age: typeof p.age, age_is_null: p.age === null, age_is_undefined: p.age === undefined});
    const ageValue = (p.age !== null && p.age !== undefined && p.age !== '') ? p.age : '--';
    const normalizedEmail = emailValue || '--';
    const therapistLabel = (p.__therapistName && !/^[a-f0-9-]{8,}$/i.test(p.__therapistName)) ? p.__therapistName : '';
    console.log('[pacientes-por-terapeuta] makeCard - AFTER calculation', 'age:', p.age, 'ageValue:', ageValue);
    div.innerHTML = `
      <header class="patient-header">
        <div class="patient-avatar">
          <img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(p.name)}"> 
        </div>
        <div class="patient-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="patient-specialty">${escapeHtml(p.diagnosis||'--')}</p>
          <p class="patient-email">${escapeHtml(normalizedEmail)}</p>
        </div>
      </header>
      <div class="patient-details">
        <p><strong>Edad:</strong> ${escapeHtml(ageValue)}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(p.phone||'--')}</p>
        <p><strong>Correo:</strong> ${escapeHtml(normalizedEmail)}</p>
        <p><strong>Terapeuta asignado:</strong> ${escapeHtml(therapistLabel)}</p>
        <p><strong>Estado:</strong> <span class="patient-status ${statusClass}">${escapeHtml(p.status||'--')}</span></p>
      </div>
      <footer class="patient-actions">
        <button class="btn btn-primary" onclick="window.location.href='../ver perfil/ver_perfil.html?id=${encodeURIComponent(p.id)}'">Ver perfil</button>
        <button class="btn btn-danger" onclick="deletePatient(this, '${encodeURIComponent(p.id)}', '${escapeHtml(p.name)}')">Eliminar</button>
      </footer>`;
    return div;
  }

  let list = [];

  function getVisiblePatients(searchQuery){
    const base = list.filter(p => matchesTherapist(p) && (!statusFilter || statusFilter !== 'active' || isActive(p)));
    if(!searchQuery) return base;
    const lowered = searchQuery.toLowerCase();
    return base.filter(p => (p.name||'').toLowerCase().includes(lowered) || (p.diagnosis||'').toLowerCase().includes(lowered));
  }

  function render(patients){
    container.innerHTML = '';
    if(patients.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      if(!therapistId){
        empty.innerHTML = '⚠️ <strong>Necesitas el parámetro therapist en la URL</strong><br>Ve a la página de Terapeutas y haz clic en "Ver pacientes"';
      } else {
        empty.textContent = 'No hay pacientes asignados a este terapeuta.';
      }
      container.appendChild(empty);
      return;
    }
    patients.forEach(p => container.appendChild(makeCard(p)));
  }

  async function refresh(){
    // Intentar cargar desde Supabase primero
    const supabaseList = await loadTherapistPatientsFromSupabase();
    if(supabaseList.length > 0){
      // Merge con cache local para foto si faltan y resolver nombre de terapeuta
      const cache = loadTherapistPatients();
      const byId = {};
      cache.forEach(p=>{ if(p && p.id) byId[String(p.id)] = p; });
      list = await Promise.all(supabaseList.map(async p=>{
        if(!p.photo){
          const c = byId[String(p.id)];
          if(c && c.photo) p.photo = c.photo;
        }
        // Resolver nombre de terapeuta para no mostrar UUID en la tarjeta
        try{
          const client = window.supabaseServiceClient || window.supabaseClient;
          if(client && p.assignedTherapist){
            const { data } = await client.from('users').select('full_name, email').eq('id', p.assignedTherapist).maybeSingle();
            p.__therapistName = data ? (data.full_name || data.email || p.assignedTherapist) : p.assignedTherapist;
          }
        }catch(_){ p.__therapistName = p.assignedTherapist; }
        return p;
      }));
      console.log('[pacientes-por-terapeuta] refresh - list after processing:', list.map(p => ({name: p.name, age: p.age, typeof_age: typeof p.age})));
    } else {
      list = loadTherapistPatients();
      console.log('[pacientes-por-terapeuta] refresh - list from cache:', list.map(p => ({name: p.name, age: p.age, typeof_age: typeof p.age})));
    }
    const searchValue = (document.getElementById('searchInput')?.value||'');
    render(getVisiblePatients(searchValue));
    if(therapistInfo){
      // Intentar obtener nombre desde URL o Supabase
      const nameParam = params.get('name');
      let displayName = nameParam || getTherapistName(therapistId);
      
      // Si no hay nombre y hay therapistId, buscar en Supabase
      if(!nameParam && therapistId){
        const client = window.supabaseServiceClient || window.supabaseClient;
        if(client){
          try{
            const { data } = await client.from('users').select('full_name, email').eq('id', therapistId).maybeSingle();
            if(data) displayName = data.full_name || data.email || therapistId;
          }catch(e){ /* ignore */ }
        }
      }
      
      therapistInfo.textContent = therapistId ? `Terapeuta: ${displayName}` : 'Pacientes';
    }
  }

  window.filterLocal = function(){
    const q = (document.getElementById('searchInput')?.value||'');
    render(getVisiblePatients(q));
  };

  // --- Delete functionality ---
  async function deletePatient(btnOrThis, id, name){
    const btn = (btnOrThis && btnOrThis.tagName) ? btnOrThis : null;
    id = decodeURIComponent(id);
    const patientName = name || 'este paciente';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
    // Intentar obtener email desde cache local para soporte de ids no UUID
    let raw; try{ raw = JSON.parse(localStorage.getItem('therapist_patients')||'[]'); }catch(e){ raw = []; }
    const flat = Array.isArray(raw) ? raw : Object.keys(raw).reduce((acc,k)=> acc.concat((raw[k]||[]).map(p=>{ if(!p.assignedTherapist) p.assignedTherapist = k; return p; })), []);
    const patient = flat.find(p=> String(p.id)===String(id));
    const patientEmail = patient ? (patient.email || patient.correo || '') : '';
    if(btn){ btn.disabled = true; const old = btn.textContent; btn.dataset.oldText = old; btn.textContent = 'Eliminando…'; }
    
    showDeleteConfirmation(patientName, async function(){
      try{
        const client = window.supabaseServiceClient || window.supabaseClient;
        if(!client){
          alert('No hay conexión con Supabase');
          return;
        }
        
        console.log('[pacientes-por-terapeuta] Eliminando paciente:', { id, patientEmail, isUuid });
        
        // Eliminar de Supabase
        let error;
        if(isUuid){
          ({ error } = await client.from('patients').delete().eq('id', id));
        } else if(patientEmail){
          ({ error } = await client.from('patients').delete().eq('email', patientEmail));
        } else {
          const { data: found, error: findErr } = await client.from('patients').select('id').eq('id', id).limit(1);
          if(findErr){ error = findErr; }
          else if(found && found.length){ ({ error } = await client.from('patients').delete().eq('id', found[0].id)); }
          else { console.warn('[pacientes-por-terapeuta] No se encontró identificador para borrar'); error = null; }
        }
        
        if(error){
          console.error('[pacientes-por-terapeuta] Error al eliminar:', error);
          alert('Error al eliminar el paciente: ' + error.message);
          if(btn){ btn.disabled = false; btn.textContent = btn.dataset.oldText || 'Eliminar'; }
          return;
        }
        
        // Eliminar del localStorage también (por id o email)
        try{
          let raw = JSON.parse(localStorage.getItem('therapist_patients')||'{}');
          const removeCheck = (p)=> String(p.id)!==String(id) && (!patientEmail || String((p.email||p.correo||'')).toLowerCase() !== String(patientEmail).toLowerCase());
          if(Array.isArray(raw)){
            raw = raw.filter(removeCheck);
          } else if(raw && typeof raw==='object'){
            Object.keys(raw).forEach(tid=>{
              raw[tid] = (raw[tid]||[]).filter(removeCheck);
            });
          }
          localStorage.setItem('therapist_patients', JSON.stringify(raw));
        }catch(e){ console.warn('Error al actualizar localStorage:', e); }
        
        // Optimista: quitar card del DOM inmediatamente y refrescar
        if(btn){ const card = btn.closest('article.patient-card'); if(card) card.remove(); }
        await refresh();
        
        // Mostrar mensaje de éxito
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
        console.error('[pacientes-por-terapeuta] Exception al eliminar:', e);
        alert('Error al eliminar el paciente');
      } finally {
        if(btn){ btn.disabled = false; btn.textContent = btn.dataset.oldText || 'Eliminar'; }
      }
    });
  }
  
  function showDeleteConfirmation(patientName, onConfirm){
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.2s ease;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 480px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
      ">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            font-size: 32px;
          ">⚠️</div>
          <h2 style="margin: 0 0 8px; color: #1e293b; font-size: 24px;">¿Eliminar paciente?</h2>
          <p style="margin: 0; color: #64748b; font-size: 16px;">
            ¿Estás seguro de que deseas eliminar a <strong style="color: #ef4444;">${escapeHtml(patientName)}</strong>?
          </p>
          <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">
            Esta acción no se puede deshacer.
          </p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-cancel" id="cancelDelete" style="flex: 1; padding: 12px;">
            Cancelar
          </button>
          <button class="btn btn-danger" id="confirmDelete" style="flex: 1; padding: 12px;">
            Eliminar
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('cancelDelete').addEventListener('click', () => overlay.remove());
    
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) overlay.remove();
    });
    
    document.getElementById('confirmDelete').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
  }
  
  window.deletePatient = deletePatient;

  window.addEventListener('storage', refresh);
  window.addEventListener('patients:updated', refresh);
  window.addEventListener('therapist-patients:loaded', refresh);

  refresh();
})();
