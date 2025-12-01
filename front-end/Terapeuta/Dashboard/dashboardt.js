// Load real authenticated therapist data from API
function escapeHtml(value){ return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
async function loadTherapistDashboard(){
  let patientsStore = [];
  let assignedExercises = [];
  let therapist = null;
  if(!window.supabaseClient){
    console.error('[dashboardt] Supabase no inicializado');
    window.location.href = '../../Administrador/login/index.html';
    return;
  }
  try{
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const session = sessionData && sessionData.session ? sessionData.session : null;
    if(!session){
      window.location.href = '../../Administrador/login/index.html';
      return;
    }
    const user = session.user;
    // Buscar terapeuta por email
    const { data: therapistRow, error: therapistError } = await window.supabaseClient
      .from('therapists')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();
    if(therapistError){ console.warn('No terapeuta por email', therapistError.message); }
    // Obtener perfil usuarios para nombre/foto
    let userProfile = null;
    try{
      const { data: profileRow, error: profileErr } = await window.supabaseClient
        .from('users')
        .select('id, email, full_name, role, photo_url, clinic')
        .eq('id', user.id)
        .maybeSingle();
      if(!profileErr && profileRow) userProfile = profileRow;
    }catch(e){ console.warn('users profile fetch error', e.message); }
    therapist = {
      id: user.id,
      email: userProfile?.email || user.email,
      full_name: userProfile?.full_name || user.user_metadata?.full_name || therapistRow?.first_name || '',
      clinic: userProfile?.clinic || therapistRow?.clinic || '',
      photo_url: userProfile?.photo_url || user.user_metadata?.photo_url || '',
      role: userProfile?.role || user.user_metadata?.role || 'therapist'
    };

    // Pacientes del terapeuta
    try{
      if(therapist.id){
        const resp = await window.SupabaseTherapists.getTherapistPatients(therapist.id);
        if(resp.success) patientsStore = resp.data;
      }
    }catch(e){ console.warn('fetch patients dashboard failed', e); }

    // Ejercicios: usar módulo si existe tabla; de momento placeholder
    try{
      if(window.SupabaseExercises){
        const exResp = await window.SupabaseExercises.getExercises();
        if(exResp.success) assignedExercises = exResp.data.slice(0,10); // mostrar algunos
      }
    }catch(e){ console.warn('fetch exercises failed', e); }

    // Actualizar sidebar
    try{
      const nameEl = document.getElementById('therapistName');
      const emailEl = document.getElementById('therapistEmail');
      const photoEl = document.getElementById('therapistPhoto');
      const displayName = therapist.full_name || therapist.email;
      if(nameEl) nameEl.textContent = displayName;
      if(emailEl) emailEl.textContent = therapist.email;
      if(photoEl && therapist.photo_url){ photoEl.setAttribute('src', therapist.photo_url); photoEl.style.display=''; }
    }catch(e){ console.warn('sidebar update failed', e); }
  }catch(err){
    console.error('[dashboardt] error cargando datos', err);
  }
  
  const todayList = document.getElementById('todayList');
  if(todayList) todayList.innerHTML = '';

  function buildAvatar(name){
    const text = (name || 'Paciente').split(' ').map(w=>w[0]).join('').toUpperCase();
    return text.slice(0,2);
  }

  function statusForPatient(patientExercises, idx){
    if(patientExercises.length === 0) return { text: 'Sin ejercicios', icon: '⏳', cls: 'status-pending' };
    if(idx % 3 === 0) return { text: 'Requiere atención', icon: '⚠️', cls: 'status-alert' };
    return { text: 'Activo', icon: '✅', cls: 'status-good' };
  }

  function makeExercisePills(patientExercises){
    const wrapper = document.createElement('div');
    wrapper.className = 'patient-exercise-list';
    if(patientExercises.length === 0){
      const pill = document.createElement('span');
      pill.className = 'patient-exercise-pill';
      pill.textContent = 'Sin ejercicios asignados';
      wrapper.appendChild(pill);
      return wrapper;
    }
    patientExercises.slice(0,2).forEach(ex=>{
      const pill = document.createElement('span');
      pill.className = 'patient-exercise-pill';
      pill.textContent = ex.pathology || 'Ejercicio personalizado';
      wrapper.appendChild(pill);
    });
    if(patientExercises.length > 2){
      const more = document.createElement('span');
      more.className = 'patient-exercise-pill';
      more.textContent = `+${patientExercises.length - 2} más`;
      wrapper.appendChild(more);
    }
    return wrapper;
  }

  function renderPatientsList(){
    if(!todayList) return;
    if(patientsStore.length === 0){
      todayList.innerHTML = '<div class="empty-state">No hay pacientes asignados</div>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'patient-tracker';
    patientsStore.slice(0, 3).forEach((patient, idx) => {
      const patientExercises = assignedExercises.filter(a =>
        (a.patientId === patient.id || a.patientId === patient.email || a.patientId === patient.name)
      );
      const card = document.createElement('article');
      card.className = 'patient-card';
      const status = statusForPatient(patientExercises, idx);
      card.innerHTML = `
        <div class="patient-card-header">
          <div class="patient-avatar">${escapeHtml(buildAvatar(patient.name))}</div>
          <div>
            <h3>${escapeHtml(patient.name || 'Paciente')}</h3>
            <p>${escapeHtml(patient.condition || patient.diagnosis || 'Seguimiento general')}</p>
          </div>
          <span class="status-pill ${status.cls}">${status.icon} ${status.text}</span>
        </div>
      `;
      const table = document.createElement('div');
      table.className = 'patient-table';
      table.innerHTML = `
        <div class="patient-row header">
          <span>Edad</span>
          <span>Estado</span>
          <span>Teléfono</span>
          <span>Última actividad</span>
        </div>
        <div class="patient-row">
          <span>${escapeHtml(patient.age || '--')}</span>
          <span>${escapeHtml(patient.status || 'Pendiente')}</span>
          <span>${escapeHtml(patient.phone || '--')}</span>
          <span>${escapeHtml(patient.lastActive || 'Sin registro')}</span>
        </div>
      `;
      card.appendChild(table);
      const exerciseRow = document.createElement('div');
      exerciseRow.className = 'patient-row exercises-row';
      const exerciseLabel = document.createElement('span');
      exerciseLabel.textContent = 'Ejercicios recientes';
      const pills = makeExercisePills(patientExercises);
      const wrapper = document.createElement('div');
      wrapper.className = 'exercise-label-row';
      wrapper.appendChild(exerciseLabel);
      wrapper.appendChild(pills);
      exerciseRow.appendChild(wrapper);
      card.appendChild(exerciseRow);
      grid.appendChild(card);
    });
    if(patientsStore.length > 3){
      const more = document.createElement('div');
      more.className = 'more-indicator';
      more.textContent = `+${patientsStore.length - 3} pacientes más`;
      grid.appendChild(more);
    }
    todayList.appendChild(grid);
  }

  if(todayList) renderPatientsList();

  // Agregar event listeners a los botones de detalles y mensajes
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('action-btn')) {
      const patientCard = e.target.closest('.patient-card');
      if (patientCard) {
        const patientName = patientCard.querySelector('.patient-name strong').textContent;
        const patientInitials = patientCard.querySelector('.patient-avatar').textContent;
        
        // Determinar si es botón de detalles o mensajes
        if (e.target.textContent.includes('Mensaje')) {
          // Store selected patient in-memory for messages page (no localStorage)
          try{ window.__selectedPatientChat = { name: patientName, initials: patientInitials }; }catch(e){}
          // Navigate to messages page
          window.location.href = '../messages.html';
        } else {
          console.log('Ver detalles de:', patientName);
          // window.location.href = '../Pacientes/pacientes.html?id=' + patientName;
        }
      }
    }
  });
  

  // Actividad reciente: ejercicios asignados recientemente
  const activityList = document.getElementById('activityList');
  if(activityList){
    activityList.innerHTML = '';
    if (assignedExercises.length === 0) {
      activityList.innerHTML = '<div class="empty-state" role="status" aria-live="polite"><div class="empty-icon">🕒</div><div>No hay actividad reciente</div></div>';
    } else {
      const recentAssignments = assignedExercises
        .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
        .slice(0, 6);
      recentAssignments.forEach(assignment => {
        const card = document.createElement('div');
        card.className = 'activity-card';
        const date = new Date(assignment.at || Date.now());
        const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
        card.innerHTML = `
          <div class="badge">Ejercicio asignado</div>
          <div class="details">
            <strong style="display:block; color:#0A1B4F;">${assignment.pathology || 'General'}</strong>
            <small style="color:#64748b;">Paciente: ${assignment.patientName || assignment.patientId || 'Desconocido'}</small>
          </div>
          <div class="time">${dateStr} · ${timeStr}</div>
        `;
        activityList.appendChild(card);
      });
    }
  }

  // Keyword focus improvements for cards
  document.querySelectorAll('.card').forEach(c=>{
    c.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ c.click(); } });
  });
}

// Ensure initialization runs whether DOMContentLoaded already fired or not
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadTherapistDashboard);
else loadTherapistDashboard();

async function logoutTherapist(){
  try{ await window.supabaseClient.auth.signOut(); }catch(e){ console.warn('supabase signOut error', e); }
  window.location.href = '../../Administrador/login/index.html';
}
window.logoutTherapist = logoutTherapist;
