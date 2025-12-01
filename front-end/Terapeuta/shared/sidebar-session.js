// sidebar-session.js
// Populate therapist sidebar (photo, name, email) from Supabase session
(function(){
  async function populateSidebar(){
    try{
      console.log('[sidebar-session] Iniciando...');
      const client = window.supabaseClientTherapist || window.supabaseClient;
      console.log('[sidebar-session] Cliente:', client ? 'encontrado (therapist)' : 'NO ENCONTRADO');
      if(!client) {
        console.warn('[sidebar-session] No hay cliente Supabase disponible');
        return;
      }
      const { data: { user } } = await client.auth.getUser();
      console.log('[sidebar-session] Usuario:', user ? user.email : 'sin sesión');
      if(!user || !user.id) {
        console.warn('[sidebar-session] No hay sesión activa');
        return;
      }
      const { data: profile, error } = await client
        .from('users')
        .select('full_name, email, photo_url')
        .eq('id', user.id)
        .maybeSingle();
      console.log('[sidebar-session] Perfil:', profile, 'Error:', error);
      const name = (profile && profile.full_name) || user.user_metadata?.full_name || user.email || 'Terapeuta';
      const email = (profile && profile.email) || user.email || '';
      const photo = (profile && profile.photo_url) || null;
      console.log('[sidebar-session] Actualizando: nombre=', name, 'email=', email, 'photo=', photo);
      var photoEl = document.getElementById('therapistPhoto'); if(photoEl && photo) photoEl.src = photo;
      var nameEl = document.getElementById('therapistName'); if(nameEl) nameEl.textContent = name;
      var emailEl = document.getElementById('therapistEmail'); if(emailEl) emailEl.textContent = email;
      console.log('[sidebar-session] ✓ Sidebar actualizado');
    }catch(e){ 
      console.error('[sidebar-session] Error:', e);
    }
  }
  // Expose and auto-run
  try{ window.populateTherapistSidebar = populateSidebar; }catch(_){}
  // Esperar a que el DOM y Supabase estén listos
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(populateSidebar, 100); });
  } else {
    setTimeout(populateSidebar, 100);
  }
})();
