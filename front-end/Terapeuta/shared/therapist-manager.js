(function(){
  console.log('[therapist-manager] Script cargado');
  async function loadRemote(){
    console.log('[therapist-manager] loadRemote iniciado');
    const client = window.supabaseClientTherapist || window.supabaseClient;
    console.log('[therapist-manager] Cliente:', client ? 'disponible' : 'NO DISPONIBLE');
    if(!client){
      console.error('[therapist-manager] Supabase no inicializado');
      return;
    }
    try{
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData && sessionData.session ? sessionData.session : null;
      if(!session){
        console.warn('[therapist-manager] Sin sesión. Redirigiendo a login.');
        window.location.href = '../../Administrador/login/index.html';
        return;
      }
      const user = session.user;
      // Obtener perfil de therapist por email
      // Obtener perfil de usuarios para nombre y foto
      let userProfile = null;
      try{
        const { data: profileRow, error: profileErr } = await client
          .from('users')
          .select('id, email, full_name, role, photo_url, clinic')
          .eq('id', user.id)
          .maybeSingle();
        if(!profileErr && profileRow) userProfile = profileRow;
      }catch(e){ console.warn('users profile fetch error', e.message); }

      const { data: therapistRow, error: therapistError } = await client
        .from('therapists')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      if(therapistError){ console.warn('No se encontró terapeuta en tabla therapists', therapistError.message); }

      const therapist = {
        id: user.id,
        email: userProfile?.email || user.email,
        first_name: therapistRow?.first_name || (userProfile?.full_name ? userProfile.full_name.split(' ')[0] : (user.user_metadata?.full_name||'')),
        last_name: therapistRow?.last_name || (userProfile?.full_name ? userProfile.full_name.split(' ').slice(1).join(' ') : ''),
        full_name: userProfile?.full_name || user.user_metadata?.full_name || therapistRow?.first_name || '',
        clinic: userProfile?.clinic || therapistRow?.clinic || user.user_metadata?.clinic || '',
        photo_url: userProfile?.photo_url || user.user_metadata?.photo_url || '',
        role: userProfile?.role || user.user_metadata?.role || 'therapist'
      };

      // Aplicar perfil al DOM
      try{
        const name = therapist.full_name || ((therapist.first_name||'') + ' ' + (therapist.last_name||'')) || therapist.email;
        const email = therapist.email || user.email || '';
        document.querySelectorAll('#therapistName').forEach(el=> el.textContent = name);
        document.querySelectorAll('#therapistEmail').forEach(el=> el.textContent = email);
        document.querySelectorAll('#therapistPhoto').forEach(el=> { if(therapist.photo_url){ try{ el.setAttribute('src', therapist.photo_url); el.style.display=''; }catch(_){} } });
      }catch(e){ console.warn('apply therapist profile DOM failed', e); }

      window.__currentUser = therapist;
      window.__therapistManager = window.__therapistManager || {};
      window.__therapistManager.current = therapist;
      window.__therapistManager.getCurrent = function(){ return window.__currentUser; };

      // Pacientes del terapeuta
      let patients = [];
      try{
        if(therapist.id){
          const resp = await window.SupabaseTherapists.getTherapistPatients(therapist.id);
          if(resp.success) {
            // Cargar fotos de perfil desde la tabla users
            const patientsWithPhotos = await Promise.all((resp.data || []).map(async (p) => {
              let photo = '';
              if(p.email) {
                try {
                  console.log('[therapist-manager] Buscando foto para:', p.email);
                  const { data: user, error } = await client.from('users').select('photo_url').eq('email', p.email).maybeSingle();
                  if(error) {
                    console.warn('[therapist-manager] Error en query foto:', p.email, error.message);
                  } else if(user && user.photo_url) {
                    photo = user.photo_url;
                    console.log('[therapist-manager] ✓ Foto cargada para', p.email, ':', photo);
                  } else {
                    console.log('[therapist-manager] Usuario sin foto:', p.email);
                  }
                } catch(e) {
                  console.warn('[therapist-manager] Excepción cargando foto para', p.email, e);
                }
              }
              
              return {
                ...p,
                name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Sin nombre',
                diagnosis: p.medical_history || p.diagnosis || '',
                assignedTherapist: p.therapist_id || '',
                assigned: p.therapist_id || '',
                status: p.status || 'Activo',
                photo: photo
              };
            }));
            
            patients = patientsWithPhotos;
          }
        }
      }catch(e){ console.warn('fetch patients failed', e); }
      window.__therapistPatients = patients;
      window.__therapistManager.getAssignedPatients = function(){ return window.__therapistPatients || []; };
      try{ window.dispatchEvent(new CustomEvent('therapist-patients:loaded', { detail: patients.slice() })); }catch(e){ }

      // Ejercicios asignados - cargar desde Supabase
      let assignedExercises = [];
      try {
        // Cargar asignaciones de todos los pacientes del terapeuta
        const patientIds = patients.map(p => p.id).filter(Boolean);
        if (patientIds.length > 0) {
          const { data, error } = await client
            .from('assigned_exercises')
            .select('*')
            .in('patient_id', patientIds)
            .order('created_at', { ascending: false });
          
          if (error) {
            console.warn('[therapist-manager] Error cargando assigned_exercises:', error.message);
          } else {
            // Mapear al formato esperado por el código legacy
            assignedExercises = (data || []).map(a => ({
              id: a.id,
              exerciseId: a.exercise_id,
              patientId: a.patient_id,
              patient: a.patient_id,
              pathology: a.pathology,
              therapistAssignedDays: a.therapist_assigned_days || null,
              therapistReps: a.therapist_reps || null,
              therapistNotes: a.therapist_notes || null,
              therapistAssignedAt: a.therapist_assigned_at || null,
              assignedAt: a.created_at,
              assignmentWeek: a.assignment_week
            }));
          }
        }
      } catch(e) {
        console.warn('[therapist-manager] Error cargando assigned_exercises:', e);
        assignedExercises = [];
      }
      window.__assignedExercises = assignedExercises;
      window.__therapistManager.getAssignedExercises = function(){ return window.__assignedExercises; };
      console.log('[therapist-manager] Ejercicios asignados cargados:', assignedExercises.length);
      
      // Disparar evento cuando las asignaciones estén listas
      try{ 
        window.dispatchEvent(new CustomEvent('assigned-exercises:loaded', { detail: assignedExercises.slice() })); 
      }catch(e){ 
        console.warn('[therapist-manager] assigned-exercises:loaded event failed', e);
      }

      try{ window.dispatchEvent(new CustomEvent('therapist-manager:loaded', { detail: { currentUser: therapist } })); }catch(e){}
      console.debug('[therapist-manager] remoto listo', { therapist, patientsCount: patients.length, assignedExercises: assignedExercises.length });
    }catch(err){
      console.error('[therapist-manager] error remoto', err);
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadRemote);
  else loadRemote();

  async function logoutTherapist(){
    const client = window.supabaseClientTherapist || window.supabaseClient;
    try{ await client.auth.signOut(); }catch(e){ console.warn('signOut error', e); }
    window.__currentUser = null;
    window.location.href = '../../Administrador/login/index.html';
  }
  window.logoutTherapist = window.logoutTherapist || logoutTherapist;
})();
