function qs(sel, root = document){ return root.querySelector(sel); } 

function showMessage(text, type){
  const msg = qs('#loginMessage');
  if(!msg) return;
  msg.textContent = text;
  msg.style.display = 'block';
  msg.className = 'login-message ' + (type || 'info');
}

function hideMessage(){ 
  const msg = qs('#loginMessage'); 
  if(msg) msg.style.display='none'; 
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if(!form) return;

  // --- Role selector ---
  const roleButtons = document.querySelectorAll('.role-btn');
  let selectedRole = 'admin'; // rol por defecto

  roleButtons.forEach(b =>
    b.addEventListener('click', () => {
      roleButtons.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      // Get role from button data attribute
      let r = b.getAttribute('data-role') || 'admin';
      selectedRole = r;
    })
  );

  // Password toggle for login form
  (function(){
    const toggle = document.getElementById('togglePassword');
    const pwd = document.getElementById('password');
    if(!toggle || !pwd) return;
    // Create simple eye icon inside the toggle if not present
    if(toggle.innerHTML.trim() === ''){
      toggle.innerHTML = '👁️';
      toggle.style.cursor = 'pointer';
    }
    toggle.addEventListener('click', function(){
      const isPwd = pwd.getAttribute('type') === 'password';
      pwd.setAttribute('type', isPwd ? 'text' : 'password');
      toggle.setAttribute('aria-pressed', String(isPwd));
    });
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const email = qs('#email').value.trim();
    const password = qs('#password').value;
    // ensure we have the current role from UI (in case user didn't click)
    const activeBtn = document.querySelector('.role-btn.active');
    if(activeBtn){
      selectedRole = activeBtn.getAttribute('data-role') || 'admin';
    }
    console.debug('[login] attempt', { email, selectedRole });

    if(!email || !password){
      showMessage('Completa email y contraseña', 'error');
      return;
    }

    try{
      showMessage('Iniciando sesión...', 'info');

      // Try Supabase authentication first
      if(window.SupabaseAuth && typeof window.SupabaseAuth.signIn === 'function'){
        try{
          const result = await window.SupabaseAuth.signIn(email, password, selectedRole);
          
          if(result.success && result.user){
            console.log('✅ Signin exitoso:', result);
            
            // Merge profile data (name, photo) from users table & auth metadata
            const userProfile = result.profile || {};
            const authMeta = result.user && result.user.user_metadata ? result.user.user_metadata : {};
            const mergedProfile = {
              id: result.user.id,
              email: userProfile.email || result.user.email,
              role: userProfile.role || authMeta.role || selectedRole,
              full_name: userProfile.full_name || authMeta.full_name || authMeta.fullName || authMeta.name || '',
              clinic: userProfile.clinic || authMeta.clinic || '',
              photo_url: userProfile.photo_url || authMeta.photo_url || authMeta.photo || ''
            };
            // Alias para compatibilidad con código que busca photo / photoUrl
            if(mergedProfile.photo_url){
              mergedProfile.photo = mergedProfile.photo_url;
              mergedProfile.photoUrl = mergedProfile.photo_url;
            }
            // Fallback: si no hay full_name intenta recuperar de un registro previo local
            if(!mergedProfile.full_name){
              try{
                const legacyAdmin = localStorage.getItem('currentUser_admin');
                if(legacyAdmin){
                  const la = JSON.parse(legacyAdmin);
                  if(la && (la.name || la.fullname)) mergedProfile.full_name = la.name || la.fullname;
                }
              }catch(e){ }
              if(!mergedProfile.full_name && mergedProfile.email){
                // Usa parte antes de @ capitalizada como nombre aproximado
                const beforeAt = mergedProfile.email.split('@')[0];
                mergedProfile.full_name = beforeAt.replace(/\./g,' ').replace(/\b\w/g,c=>c.toUpperCase());
              }
            }
            const userRole = mergedProfile.role;
            
            // Store user info
            // Segundo intento: si falta photo_url intentar leer directamente tabla users (service role) antes de almacenar
            if(!mergedProfile.photo_url){
              try {
                const client = window.supabaseServiceClient || window.supabaseClient;
                if(client){
                  const { data: userRow, error: userRowErr } = await client
                    .from('users')
                    .select('full_name, photo_url, clinic, role')
                    .eq('id', result.user.id)
                    .maybeSingle();
                  if(!userRowErr && userRow){
                    mergedProfile.full_name = mergedProfile.full_name || userRow.full_name || '';
                    mergedProfile.photo_url = userRow.photo_url || mergedProfile.photo_url || '';
                    if(mergedProfile.photo_url){
                      mergedProfile.photo = mergedProfile.photo_url;
                      mergedProfile.photoUrl = mergedProfile.photo_url;
                    }
                  }
                }
              }catch(fetchProfErr){ console.warn('[login] fetch users row fallback error', fetchProfErr.message); }
            }

            // Guardar perfil final
            window.__currentUser = mergedProfile;
            window.__currentProfile = mergedProfile;
            try{ sessionStorage.setItem('currentUser', JSON.stringify(mergedProfile)); }catch(e){ console.warn('sessionStorage currentUser fail', e.message); }
            try{ localStorage.setItem('auth_profile', JSON.stringify(mergedProfile)); }catch(e){ console.warn('localStorage auth_profile fail', e.message); }
            if(mergedProfile.role === 'admin'){
              try{ localStorage.setItem('currentUser_admin', JSON.stringify(mergedProfile)); }catch(e){ console.warn('localStorage currentUser_admin fail', e.message); }
            }
            console.debug('[login] stored mergedProfile', mergedProfile);
            // Aplicar inmediatamente a elementos si existen en esta vista (por si el dashboard está embebido)
            try{
              const nameElA = document.getElementById('adminName');
              const emailElA = document.getElementById('adminEmail');
              const photoElA = document.getElementById('adminPhoto');
              if(nameElA) nameElA.textContent = mergedProfile.full_name || mergedProfile.email;
              if(emailElA) emailElA.textContent = mergedProfile.email;
              if(photoElA && mergedProfile.photo_url) { photoElA.src = mergedProfile.photo_url; photoElA.style.display=''; }
              const nameElT = document.getElementById('therapistName');
              const emailElT = document.getElementById('therapistEmail');
              const photoElT = document.getElementById('therapistPhoto');
              if(nameElT) nameElT.textContent = mergedProfile.full_name || mergedProfile.email;
              if(emailElT) emailElT.textContent = mergedProfile.email;
              if(photoElT && mergedProfile.photo_url){ photoElT.src = mergedProfile.photo_url; photoElT.style.display=''; }
            }catch(e){ console.warn('[login] no se pudieron aplicar elementos de perfil', e.message); }
            
            showMessage('Inicio de sesión correcto, redirigiendo...', 'success');
            
            // Redirect based on role
            setTimeout(()=> {
              if(userRole === 'therapist'){
                window.location.href = '../../Terapeuta/Dashboard/dashboardt.html';
              } else if(userRole === 'admin'){
                window.location.href = '../Dashboard/dashboard-admin.html';
              } else {
                window.location.href = '/Pacientes/pacientes.html';
              }
            }, 300);
            return;
          } else {
            console.error('❌ Signin falló:', result.error);
            showMessage(result.error || 'Credenciales inválidas', 'error');
            return;
          }
        }catch(errSupabase){
          console.error('Supabase auth error:', errSupabase);
          showMessage('Error de autenticación: ' + (errSupabase.message || errSupabase), 'error');
          return;
        }
      } else {
        showMessage('Supabase no está disponible', 'error');
        return;
      }

    } catch(err){
      console.error('Login failed', err);
      showMessage('Error al iniciar sesión: ' + (err.message || err), 'error');
    }
  });
});
