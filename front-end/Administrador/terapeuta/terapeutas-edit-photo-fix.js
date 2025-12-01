// Parche para saveTherapistEdits: sube foto a Supabase y actualiza users.photo_url
(function(){
  // Sobrescribir saveTherapistEdits original
  window.saveTherapistEditsOriginal = window.saveTherapistEdits || function(){};
  
  window.saveTherapistEdits = async function() {
    const tid = document.getElementById('editTid').value;
    const card = document.querySelector(`[data-therapist-id="${tid}"]`);
    if (!card) {
      alert('Error al guardar: tarjeta no encontrada.');
      return;
    }

    const nombre = document.getElementById('editNombre').value.trim();
    const especialidad = document.getElementById('editEspecialidad').value.trim();
    const telefono = document.getElementById('editTelefono').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const experiencia = document.getElementById('editExperiencia').value.trim();
    const estado = document.getElementById('editEstado').value;
    let photoData = document.getElementById('editPhotoData').value;

    // Subir foto real a Supabase Storage si el usuario seleccionó un archivo
    const photoInput = document.getElementById('editPhoto');
    const file = photoInput && photoInput.files && photoInput.files[0];
    if (file && window.SupabaseStorage) {
      try {
        const sbClient = window.supabaseServiceClient || window.supabaseClient;
        let userId = null;
        if (sbClient) {
          const { data: urow } = await sbClient.from('users').select('id').eq('email', email).maybeSingle();
          userId = urow && urow.id ? urow.id : null;
        }
        if (userId) {
          const up = await window.SupabaseStorage.uploadProfilePhoto(userId, file);
          if (up.success && up.publicUrl) {
            photoData = up.publicUrl;
            console.log('[edit] Foto subida:', up.publicUrl);
            // Actualizar users.photo_url
            try {
              if (window.SupabaseAuth) {
                await window.SupabaseAuth.updateUserProfile(userId, { photo_url: up.publicUrl });
                console.log('[edit] users.photo_url actualizado');
              }
            } catch (e) { console.warn('updateUserProfile edit terapeuta falló', e.message); }
            // Actualizar metadata auth
            try {
              if (sbClient && sbClient.auth && sbClient.auth.admin) {
                await sbClient.auth.admin.updateUserById(userId, { user_metadata: { photo_url: up.publicUrl } });
              }
            } catch (e) { console.warn('auth metadata edit terapeuta falló', e.message); }
          } else {
            console.warn('uploadProfilePhoto en edit falló:', up.error);
          }
        } else {
          console.warn('No se pudo identificar user_id para terapeuta con email:', email);
        }
      } catch (e) {
        console.warn('Subida de foto en edit falló:', e.message);
      }
    }

    // Update DOM
    const nameEl = card.querySelector('.therapist-info h3');
    if (nameEl) nameEl.textContent = nombre;

    const details = card.querySelectorAll('.therapist-details p');
    if (details[0]) details[0].innerHTML = `<strong>Especialidad:</strong> ${especialidad}`;
    if (details[1]) details[1].innerHTML = `<strong>📞 Teléfono:</strong> ${telefono}`;
    if (details[2]) details[2].innerHTML = `<strong>📧 Email:</strong> ${email}`;
    if (details[3]) details[3].innerHTML = `<strong>🎓 Experiencia:</strong> ${experiencia} años`;

    const statusEl = card.querySelector('.status-badge');
    if (statusEl) {
      statusEl.textContent = estado;
      statusEl.className = 'status-badge';
      if (estado.toLowerCase() === 'activo') statusEl.classList.add('status-active');
      else if (estado.toLowerCase() === 'pendiente') statusEl.classList.add('status-pending');
      else statusEl.classList.add('status-inactive');
    }

    const avatarImg = card.querySelector('.therapist-avatar img');
    const photoSrc = photoData || (window.buildTherapistAvatar ? window.buildTherapistAvatar(card.dataset.photo || '') : '');
    if (avatarImg) avatarImg.src = photoSrc;

    card.dataset.name = nombre;
    card.dataset.specialty = especialidad;
    card.dataset.phone = telefono;
    card.dataset.email = email;
    card.dataset.experience = experiencia;
    card.dataset.status = estado;
    card.dataset.photo = photoData || '';

    // Actualizar tabla therapists en Supabase
    try {
      const sbClient = window.supabaseServiceClient || window.supabaseClient;
      if (sbClient) {
        const nameParts = (nombre || '').split(' ');
        const updates = {
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          email: email || '',
          phone: telefono || '',
          specialization: especialidad || ''
        };
        const { error } = await sbClient.from('therapists').update(updates).eq('email', email);
        if (error) console.warn('therapists update falló:', error.message);
        else console.log('[edit] therapists actualizado');
      }
    } catch (e) {
      console.warn('Error al actualizar therapists en Supabase:', e.message);
    }

    // Persist to localStorage if therapists array exists
    try {
      const list = JSON.parse(localStorage.getItem('therapists') || '[]');
      const index = list.findIndex(t => t.id === tid || t.id === tid.replace(/^t/,'') || t.id === tid);
      if (index > -1) {
        list[index].name = nombre;
        list[index].specialty = especialidad;
        list[index].phone = telefono;
        list[index].email = email;
        list[index].experience = experiencia;
        list[index].active = (estado.toLowerCase() === 'activo');
        list[index].photo = photoData || '';
        list[index].status = estado;
        localStorage.setItem('therapists', JSON.stringify(list));
        window.__therapists = list;
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.warn('No se pudo persistir cambios en localStorage:', e);
    }

    // Cerrar modal
    const modal = document.getElementById('therapistEditModal');
    if (modal) modal.classList.remove('show');
    
    // Recargar lista para reflejar cambios
    if (window.loadAndRenderTherapists) {
      await window.loadAndRenderTherapists();
    }
  };
})();
