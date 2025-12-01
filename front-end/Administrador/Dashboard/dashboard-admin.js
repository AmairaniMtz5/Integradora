// Minimal dashboard-admin.js to avoid 404 and wire up profile once DOM is ready
// It relies on admin-manager.js for actual profile logic; here we ensure admin-manager is loaded and invoke helper
(function(){
  function safeParse(v){ try{ return JSON.parse(v||'null'); }catch(e){ return null; } }
  function readArray(key){ try{ const v = JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
  function getTherapists(){ if(window.localStore && typeof window.localStore.getTherapists === 'function') return window.localStore.getTherapists() || []; return readArray('therapists'); }
  function getPatients(){ if(window.localStore && typeof window.localStore.getPatients === 'function') return window.localStore.getPatients() || []; return readArray('therapist_patients'); }
  function updateCounts(){
    const therapistEl = document.getElementById('therapistsCount');
    const patientEl = document.getElementById('patientsCount');
    if(therapistEl){ therapistEl.textContent = String(getTherapists().length || 0); }
    if(patientEl){ patientEl.textContent = String(getPatients().length || 0); }
  }

  // --- Supabase-powered real-time patients count ---
  async function updatePatientsCountFromSupabase(){
    try{
      const el = document.getElementById('patientsCount');
      const client = window.supabaseServiceClient || window.supabaseClient;
      if(!client){
        // fallback local
        if(el) el.textContent = String(getPatients().length || 0);
        console.warn('[admin-dashboard] Supabase no disponible, usando localStorage para pacientes');
        return;
      }
      // count exact without fetching rows
      const { count, error } = await client.from('patients').select('*', { count: 'exact', head: true });
      if(error){
        console.warn('[admin-dashboard] count patients error:', error.message);
        if(el) el.textContent = String(getPatients().length || 0);
        return;
      }
      if(el) el.textContent = String(count || 0);
      console.log('[admin-dashboard] Pacientes (Supabase):', count || 0);
    }catch(e){
      console.warn('[admin-dashboard] count patients ex:', e.message);
    }
  }

  function initRealtimePatientsCount(){
    const client = window.supabaseServiceClient || window.supabaseClient;
    if(!client){ updatePatientsCountFromSupabase(); return; }
    // initial load
    updatePatientsCountFromSupabase();
    try{
      const channel = client
        .channel('realtime:patients-count')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, (payload) => {
          console.log('[admin-dashboard] Cambio en patients:', payload.eventType);
          // any insert/update/delete → refresh count
          updatePatientsCountFromSupabase();
        })
        .subscribe((status)=>{
          if(status === 'SUBSCRIBED'){ console.log('[admin-dashboard] Realtime suscrito a patients'); }
        });
      // safety: fallback polling if realtime not supported
      setTimeout(()=>{
        if(!channel || (channel.state && channel.state !== 'joined')){
          const timer = setInterval(updatePatientsCountFromSupabase, 10000);
          // store timer if needed
          window.__adminPatientsCountPoll = timer;
        }
      }, 3000);
    }catch(e){
      // polling fallback every 10s
      window.__adminPatientsCountPoll = setInterval(updatePatientsCountFromSupabase, 10000);
    }
  }

  function applyProfile(){
    try{
      if(window.__adminManager && typeof window.__adminManager.loadLocalProfile === 'function'){
        window.__adminManager.loadLocalProfile();
        return;
      }
      const cur = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser_admin') || localStorage.getItem('currentUser');
      const user = safeParse(cur);
      if(!user) return;
      const nameEl = document.getElementById('adminName');
      const emailEl = document.getElementById('adminEmail');
      const photoEl = document.getElementById('adminPhoto');
      if(nameEl) nameEl.textContent = user.name || user.fullname || user.email || 'Administrador';
      if(emailEl && (user.email || user.mail || user.correo)) emailEl.textContent = user.email || user.mail || user.correo;
      if(photoEl){ const src = user.photo || user.photoUrl || user.avatar || ''; if(src) photoEl.src = src; }
    }catch(e){ console.warn('dashboard-admin helper failed', e); }
  }

  function initDashboard(){
    applyProfile();
    // therapists still from local cache for now
    const therapistEl = document.getElementById('therapistsCount');
    if(therapistEl){ therapistEl.textContent = String(getTherapists().length || 0); }
    // patients in real time via Supabase
    initRealtimePatientsCount();
  }

  function onDomReady(fn){
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onDomReady(initDashboard);

  // Mantener therapists desde cache local
  window.addEventListener('therapists:updated', function(){
    const therapistEl = document.getElementById('therapistsCount');
    if(therapistEl){ therapistEl.textContent = String(getTherapists().length || 0); }
  });
  // Para pacientes, siempre refrescar desde Supabase para evitar sobrescribir con 0 del localStorage
  window.addEventListener('patients:updated', function(){ updatePatientsCountFromSupabase(); });
  window.addEventListener('storage', function(e){
    if(!e || !e.key) return;
    if(e.key.includes('therapist')){
      const therapistEl = document.getElementById('therapistsCount');
      if(therapistEl){ therapistEl.textContent = String(getTherapists().length || 0); }
    }
    if(e.key.includes('patient')){
      updatePatientsCountFromSupabase();
    }
  });
})();
