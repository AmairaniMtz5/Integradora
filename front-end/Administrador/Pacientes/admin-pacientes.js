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
  const container = document.getElementById('patientsContainer');
  if(!container) return;

  const params = new URLSearchParams(window.location.search);
  const filter = params.get('filter');
  const therapistParam = params.get('therapist') || null;

  let patients = readPatients();
  let therapists = readTherapists();

  function getTherapistName(id){ if(!id) return '--'; const t = therapists.find(x=>x.id===id); return t? t.name : id; }

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
        <p><strong>Terapeuta asignado:</strong> ${escapeHtml(getTherapistName(p.assignedTherapist))}</p>
        <p><strong>Correo:</strong> ${escapeHtml(p.email||p.correo||'--')}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(p.phone||'--')}</p>
        <p><strong>Estado:</strong> <span class="patient-status ${statusClass}">${escapeHtml(p.status||'--')}</span></p>
      </div>
      <div class="patient-actions">
        <button class="btn btn-primary" onclick="window.location.href='../ver perfil/ver_perfil.html?id=${encodeURIComponent(p.id)}'">Ver perfil</button>
        <button class="btn btn-edit" onclick="editPatient('${encodeURIComponent(p.id)}')">Editar</button>
        <button class="btn btn-danger" onclick="deletePatient('${encodeURIComponent(p.id)}')">Eliminar</button>
      </div>`;
    return div;
  }

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Note: therapist filter select removed from the UI. If a therapist URL param exists, it will still be used.

  function renderForSelection(){
    let list = patients.slice();
    if(filter==='active') list = list.filter(p=> p.status && p.status.toLowerCase().includes('activo'));
    const selected = (therapistParam||null);
    if(selected) list = list.filter(p=> p.assignedTherapist === selected);

    container.innerHTML = '';
    if(list.length===0){ container.innerHTML = '<div class="empty-state">No hay pacientes que coincidan con el filtro.</div>'; return; }
    list.forEach(p=> container.appendChild(makeCard(p)));
  }

  // initial render
  renderForSelection();

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

  // update when patients/therapists change
  function refreshPatients(){ patients = readPatients(); therapists = readTherapists(); renderForSelection(); }
  window.addEventListener('storage', function(){ try{ refreshPatients(); }catch(e){} });
  window.addEventListener('patients:updated', function(){ try{ refreshPatients(); }catch(e){} });

  // also keep a window-level cache for other modules
  try{ window.__therapistPatients = patients.slice(); }catch(e){}
  // update cache when changes arrive
  function refreshAndCache(){ patients = readPatients(); try{ window.__therapistPatients = patients.slice(); }catch(e){}; renderForSelection(); }
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
  function deletePatient(id){
    id = decodeURIComponent(id);
    if(!confirm('¿Eliminar este paciente?')) return;
    let raw; try{ raw = JSON.parse(localStorage.getItem('therapist_patients')||'[]'); }catch(e){ raw = []; }
    const updated = filterOut(raw, id);
    writePatientsRaw(updated);
    refreshAndCache();
    alert('Paciente eliminado');
  }
  window.deletePatient = deletePatient;

  function findAndUpdate(raw, id, updater){
    if(Array.isArray(raw)) return raw.map(p=> String(p.id)===String(id)? updater(p): p);
    if(raw && typeof raw==='object'){
      const out={}; Object.keys(raw).forEach(tid=>{ out[tid] = (raw[tid]||[]).map(p=> String(p.id)===String(id)? updater(p): p); }); return out;
    }
    return raw;
  }
  function editPatient(id){
    id = decodeURIComponent(id);
    let raw; try{ raw = JSON.parse(localStorage.getItem('therapist_patients')||'[]'); }catch(e){ raw = []; }
    const flat = Array.isArray(raw) ? raw : Object.keys(raw).reduce((acc,k)=> acc.concat((raw[k]||[]).map(p=>{ if(!p.assignedTherapist) p.assignedTherapist = k; return p; })), []);
    const current = flat.find(p=> String(p.id)===String(id));
    if(!current){ alert('Paciente no encontrado'); return; }
    
    // Populate therapist select
    const therapistSelect = document.getElementById('editTherapist');
    if(therapistSelect){
      therapistSelect.innerHTML = '<option value="">Seleccionar terapeuta</option>';
      therapists.forEach(t=> {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        if(t.id === current.assignedTherapist) opt.selected = true;
        therapistSelect.appendChild(opt);
      });
    }
    
    // Populate form with current values
    document.getElementById('editPatientId').value = id;
    document.getElementById('editName').value = current.name || '';
    document.getElementById('editAge').value = current.age || '';
    document.getElementById('editEmail').value = current.email || current.correo || '';
    document.getElementById('editPhone').value = current.phone || '';
    document.getElementById('editDiagnosis').value = current.diagnosis || current.condition || '';
    document.getElementById('editStatus').value = current.status || 'Activo';
    document.getElementById('editNotes').value = current.notes || '';
    
    // Show modal
    document.getElementById('editModal').classList.add('active');
  }
  window.editPatient = editPatient;

  function closeEditModal(){
    document.getElementById('editModal').classList.remove('active');
  }
  window.closeEditModal = closeEditModal;

  function savePatientChanges(){
    const id = document.getElementById('editPatientId').value;
    const name = document.getElementById('editName').value.trim();
    const age = document.getElementById('editAge').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const diagnosis = document.getElementById('editDiagnosis').value.trim();
    const status = document.getElementById('editStatus').value;
    const assignedTherapist = document.getElementById('editTherapist').value;
    const notes = document.getElementById('editNotes').value.trim();
    
    if(!name || !age || !email || !phone || !diagnosis || !assignedTherapist){
      alert('Por favor completa todos los campos obligatorios');
      return;
    }
    
    let raw; try{ raw = JSON.parse(localStorage.getItem('therapist_patients')||'[]'); }catch(e){ raw = []; }
    const updatedRaw = findAndUpdate(raw, id, (p)=> Object.assign({}, p, {
      name, age, email, phone, diagnosis, status, assignedTherapist, notes,
      correo: email // Keep both email and correo for compatibility
    }));
    writePatientsRaw(updatedRaw);
    refreshAndCache();
    closeEditModal();
    alert('Paciente actualizado correctamente');
  }
  window.savePatientChanges = savePatientChanges;

  // Close modal when clicking outside
  document.getElementById('editModal').addEventListener('click', function(e){
    if(e.target === this) closeEditModal();
  });
})();
