// alta-terapeuta.js
(function(){
  const form = document.getElementById('therapistForm');
  const successBox = document.getElementById('successMessage');
  const creds = document.getElementById('therapistCredentials');

  function readTherapists(){
    try{ if(window.localStore && localStore.getTherapists) return localStore.getTherapists(); }catch(e){}
    try{ return JSON.parse(localStorage.getItem('therapists')||'[]'); }catch(e){ return []; }
  }
  function writeTherapists(arr){
    try{ if(window.localStore && localStore.addTherapist){ // sync array into localStore
        (arr||[]).forEach(t=> localStore.addTherapist(t));
        return;
      }
    }catch(e){ }
    try{ localStorage.setItem('therapists', JSON.stringify(arr)); try{ window.dispatchEvent(new Event('therapists:updated')); }catch(e){} }catch(e){ }
  }

  function uid(){ return 't' + Date.now().toString(36); }

  function showSuccess(t){
    // Show floating toast instead of inline box
    const toastArea = document.getElementById('toastContainer');
    if(!toastArea) return;
    const id = 'toast_'+Date.now();
    const el = document.createElement('div');
    el.className = 'toast toast-success';
    el.id = id;
    el.innerHTML = `
      <div class="toast-body">
        <strong>✅ Terapeuta registrado</strong>
        <div class="toast-text"><div><strong>Nombre:</strong> ${escapeHtml(t.name)}</div><div><strong>Usuario:</strong> ${escapeHtml(t.email)}</div></div>
      </div>
      <button class="toast-close" aria-label="Cerrar">×</button>
    `;
    toastArea.appendChild(el);
    // close handler
    el.querySelector('.toast-close').addEventListener('click', ()=> removeToast(el));
    // auto remove
    setTimeout(()=> removeToast(el), 6000);
  }

  function removeToast(el){
    if(!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(()=> el.remove(), 250);
  }

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  window.limpiarFormulario = function(){ form.reset(); successBox.style.display='none'; };

  if(form){
    // enhanced save flow: confirmation modal and large success overlay
    const confirmModal = document.getElementById('confirmModal');
    const confirmSaveBtn = document.getElementById('confirmSave');
    const cancelConfirmBtn = document.getElementById('cancelConfirm');
    const successOverlay = document.getElementById('successOverlay');
    const goToTherapistsBtn = document.getElementById('goToTherapists');
    let pendingTherapist = null;

    form.addEventListener('submit', function(e){
      e.preventDefault();
      const name = document.getElementById('nombre').value.trim();
      const especialidad = document.getElementById('especialidad').value;
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const telefono = document.getElementById('telefono').value.trim();
      const activo = document.getElementById('activo').checked;
      // validations
      if(!name || !email || !password) { alert('Por favor completa los campos obligatorios'); return; }
      // duplicate email check (quick client-side) across admins, therapists and patients
      try{
        const lower = String(email||'').toLowerCase();
        // admins
        try{ if(window.localStore && typeof localStore.getAdminByEmail === 'function'){ if(localStore.getAdminByEmail(lower)){ alert('El correo ' + email + ' ya está en uso por un administrador.'); return; } } else { const admins = JSON.parse(localStorage.getItem('admins')||'[]'); if((admins||[]).some(a=> (a.email||'').toLowerCase()===lower)){ alert('El correo ' + email + ' ya está en uso por un administrador.'); return; } } }catch(e){}
        // patients
        try{ const patients = JSON.parse(localStorage.getItem('therapist_patients')||'[]'); if((patients||[]).some(p=> (p.email||'').toLowerCase()===lower)){ alert('El correo ' + email + ' ya está en uso por un paciente.'); return; } }catch(e){}
        // therapists
        try{ const therapists = readTherapists(); if((therapists||[]).some(t=> (t.email||'').toLowerCase()===lower)){ alert('El correo ' + email + ' ya está en uso por otro terapeuta.'); return; } }catch(e){}
      }catch(e){ console.warn('duplicate check failed', e); }

      // process photo if present
      const photoInput = document.getElementById('foto');
      const file = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
      const proceed = function(photoData){
        pendingTherapist = { id: uid(), name, photo: photoData || '', specialty: especialidad, email, password, phone: telefono, active: !!activo, createdAt: new Date().toISOString() };
        // show confirmation modal
        if(confirmModal){ confirmModal.setAttribute('aria-hidden','false'); confirmModal.style.display='flex'; confirmSaveBtn && confirmSaveBtn.focus(); }
      };
      if(file){
        // read dataURL
        const reader = new FileReader();
        reader.onload = function(){ proceed(reader.result); };
        reader.onerror = function(){ alert('No se pudo leer la imagen'); proceed(''); };
        // limit 5MB
        if(file.size > 5 * 1024 * 1024){ alert('La imagen excede 5MB'); return; }
        reader.readAsDataURL(file);
      } else {
        proceed('');
      }
    });

    cancelConfirmBtn && cancelConfirmBtn.addEventListener('click', function(){
      pendingTherapist = null;
      if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
    });

    confirmSaveBtn && confirmSaveBtn.addEventListener('click', function(){
      if(!pendingTherapist) return;
      // Save to Supabase
      (async function(){
        try{
          // Check if Supabase modules are loaded
          if(!window.supabaseClient || !window.SupabaseAuth){
            alert('Sistema de Supabase no está disponible. Por favor recarga la página.');
            return;
          }
          
          // Step 1: Create user in Auth first (defensive against null)
          const p = pendingTherapist || {};
          const authResult = await window.SupabaseAuth.signUp({
            email: p.email || '',
            password: p.password || '',
            fullName: p.name || '',
            role: 'therapist'
          });
          
          if(!authResult.success){
            alert('Error al registrar en Auth: ' + (authResult.error || 'Error desconocido'));
            pendingTherapist = null;
            if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
            return;
          }
          
          const userId = authResult.user?.id;
          if(!userId){
            alert('No se pudo obtener el ID del usuario');
            pendingTherapist = null;
            if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
            return;
          }
          
          // Step 2: Create therapist profile in database using service role client
          const client = window.supabaseServiceClient || window.supabaseClient;
          
          // Build the therapist record with basic fields that definitely exist
          const therapistData = {
            first_name: (p.name || '').split(' ')[0],
            last_name: (p.name || '').split(' ').slice(1).join(' '),
            email: p.email || '',
            phone: p.phone || '',
            specialization: p.specialty || '',
            clinic: 'Clínica Principal',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Try insert first
          let therapistResult = await client
            .from('therapists')
            .insert([therapistData])
            .select();
          
          // If insert fails because email already exists, try update
          if (therapistResult.error) {
            console.warn('Insert failed, trying update:', therapistResult.error);
            therapistResult = await client
              .from('therapists')
              .update(therapistData)
              .eq('email', pendingTherapist.email)
              .select();
          }
          
          if(therapistResult.error){
            throw therapistResult.error;
          }
          
          // Subir foto si existe y actualizar users.photo_url con verificación
          try{
            if(p && p.photo){
              const fileInput = document.getElementById('foto');
              const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
              if(file && window.SupabaseStorage){
                const up = await window.SupabaseStorage.uploadProfilePhoto(userId, file);
                if(up.success && up.publicUrl){
                  let updated = false;
                  try{
                    const res = await window.SupabaseAuth.updateUserProfile(userId, { photo_url: up.publicUrl });
                    updated = !!res;
                  }catch(e){ console.warn('updateUserProfile photo_url terapeuta falló', e.message); }
                  try{ await window.supabaseClient.auth.updateUser({ data: { photo_url: up.publicUrl } }); }catch(e){ console.warn('auth.updateUser photo_url terapeuta falló', e.message); }
                  // Verificar que quedó en la tabla users; si no, intentar update por email
                  try{
                    const sb = window.supabaseServiceClient || window.supabaseClient;
                    if(sb){
                      const { data: check } = await sb.from('users').select('photo_url').eq('id', userId).single();
                      const ok = check && check.photo_url;
                      if(!ok){
                        const { error: up2err } = await sb.from('users').update({ photo_url: up.publicUrl }).eq('email', p.email || '').select();
                        if(up2err){ console.warn('users update por email falló', up2err.message); }
                      }
                    }
                  }catch(e){ console.warn('verificación/actualización secundaria de photo_url falló', e.message); }
                } else if(!up.success){
                  console.warn('uploadProfilePhoto falló:', up.error);
                }
              }
            }
          }catch(e){ console.warn('Subida foto terapeuta falló', e.message); }

          // Show success UI
          if(p){
            showSuccess({
              name: p.name || '',
              email: p.email || ''
            });
          }
          
          if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
          if(successOverlay){ successOverlay.setAttribute('aria-hidden','false'); successOverlay.style.display='flex'; }
          
          form.reset();
          pendingTherapist = null;
          
          // Redirect after success
          setTimeout(()=>{ window.location.href = '../terapeuta/terapeutas.html'; }, 2000);
        }catch(err){ 
          console.error('Error saving therapist to Supabase:', err);
          alert('Error al guardar el terapeuta: ' + err.message);
          pendingTherapist = null;
          if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
        }
      })();
    });

    goToTherapistsBtn && goToTherapistsBtn.addEventListener('click', function(){ window.location.href = '../terapeuta/terapeutas.html'; });
    // close handlers: modal close button, overlay click and Escape key
    const modalCloseBtn = document.querySelector('#confirmModal .modal-close');
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', ()=>{ pendingTherapist=null; confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; });
    if(confirmModal) confirmModal.addEventListener('click', function(ev){ if(ev.target===confirmModal){ pendingTherapist=null; confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }});
    document.addEventListener('keydown', function(ev){ if(ev.key==='Escape'){
      if(confirmModal && confirmModal.getAttribute('aria-hidden')==='false'){ pendingTherapist=null; confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
      if(successOverlay && successOverlay.getAttribute('aria-hidden')==='false'){ successOverlay.setAttribute('aria-hidden','true'); successOverlay.style.display='none'; }
    }});
  }
})();
