// Script único de alta de paciente (Supabase + UI + validaciones)
(function(){
    var currentPhotoData = null;
    let pendingPatient = null;

    // Cargar terapeutas directamente desde Supabase
    async function populateTherapistSelect(){
        const select = document.getElementById('assignedTherapist');
        if(!select) return;
        select.innerHTML = '';
        const emptyOpt = document.createElement('option'); emptyOpt.value=''; emptyOpt.textContent='(Sin asignar)'; select.appendChild(emptyOpt);
        try {
            const client = window.supabaseServiceClient || window.supabaseClient;
            if(!client){ console.warn('Supabase no disponible'); return; }
            // Usar tabla users para obtener UUID correcto (FK patients.therapist_id -> users.id)
            const { data: usersTherapists, error } = await client.from('users').select('id, full_name, email, role').eq('role','therapist');
            if(error){ console.warn('Error cargando terapeutas (users)', error.message); return; }
            (usersTherapists||[]).forEach(t=>{
                const opt = document.createElement('option');
                opt.value = t.id; // UUID válido
                opt.dataset.email = t.email;
                opt.textContent = t.full_name || t.email;
                select.appendChild(opt);
            });
        }catch(e){ console.warn('Fallo populateTherapistSelect', e.message); }
    }

    // Foto y previsualización
    function setupPhotoPreview(){
        var input = document.getElementById('photo');
        var preview = document.getElementById('photoPreview');
        if(!input || !preview) return;
        input.addEventListener('change', function(e){
            var file = e.target.files && e.target.files[0];
            if(!file){ currentPhotoData=null; preview.src=''; preview.style.display='none'; return; }
            var reader = new FileReader();
            reader.onload = function(ev){ currentPhotoData = ev.target.result; preview.src=currentPhotoData; preview.style.display='block'; };
            reader.readAsDataURL(file);
        });
        preview.addEventListener('click', function(){ input.click(); });
    }

    // UI elements
    const form = document.getElementById('adminNewPatientForm');
    const confirmModal = document.getElementById('confirmModal');
    const confirmSaveBtn = document.getElementById('confirmSave');
    const cancelConfirmBtn = document.getElementById('cancelConfirm');
    const successOverlay = document.getElementById('successOverlay');
    const goToPatientsBtn = document.getElementById('goToPatients');

    // Validación duplicados (en memoria/localStorage) para feedback inmediato
    function emailInUse(email){
        const lower = String(email||'').toLowerCase();
        try {
            const admins = JSON.parse(localStorage.getItem('admins')||'[]');
            if((admins||[]).some(a=> (a.email||'').toLowerCase()===lower)) return 'administrador';
        }catch(e){}
        try {
            const therapists = JSON.parse(localStorage.getItem('therapists')||'[]');
            if((therapists||[]).some(t=> (t.email||'').toLowerCase()===lower)) return 'terapeuta';
        }catch(e){}
        try {
            const patients = JSON.parse(localStorage.getItem('therapist_patients')||'[]');
            if((patients||[]).some(p=> (p.email||'').toLowerCase()===lower)) return 'paciente';
        }catch(e){}
        return null;
    }

    // Evento submit (abrir modal confirmación)
    if(form){
        form.addEventListener('submit', function(e){
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            if(!name){ alert('El nombre es requerido'); return; }
            if(!email){ alert('El correo electrónico es requerido'); return; }
            if(!password){ alert('La contraseña es requerida'); return; }
            const dup = emailInUse(email);
            if(dup){ alert('El correo ya está en uso por un ' + dup); return; }
            pendingPatient = {
                name,
                age: document.getElementById('age').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                status: document.getElementById('status').value,
                diagnosis: document.getElementById('diagnosis').value,
                assignedTherapist: document.getElementById('assignedTherapist').value || null,
                summary: document.getElementById('summary').value.trim(),
                email,
                password,
                photo: currentPhotoData || null
            };
            if(confirmModal){ confirmModal.setAttribute('aria-hidden','false'); confirmModal.style.display='flex'; }
            if(confirmSaveBtn) confirmSaveBtn.focus();
        });
    }

    if(cancelConfirmBtn){
        cancelConfirmBtn.addEventListener('click', function(){
            pendingPatient=null;
            if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
        });
    }

    // Guardar en Supabase cuando se confirma
    if(confirmSaveBtn){
        confirmSaveBtn.addEventListener('click', async function(){
            const p = pendingPatient || {};
            if(!p.email || !p.password || !p.name) {
                alert('Datos incompletos. Por favor, llena el formulario nuevamente.');
                pendingPatient = null;
                if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
                return;
            }
            try {
                if(!window.supabaseClient || !window.SupabaseAuth){
                    alert('Supabase no está disponible. Recarga la página.');
                    return;
                }
                // Crear usuario Auth primero
                const authResult = await window.SupabaseAuth.signUp({
                    email: p.email,
                    password: p.password,
                    fullName: p.name,
                    role: 'patient'
                });
                if(!authResult.success){ throw new Error(authResult.error || 'Error en Auth'); }
                console.log('[paciente] Usuario auth creado:', authResult.user.id);

                // Primero subir foto para obtener URL
                let photoUrl = null;
                const fileInput = document.getElementById('photo');
                const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
                if(file && window.SupabaseStorage && authResult.user && authResult.user.id){
                    console.log('[paciente] Subiendo foto...');
                    const up = await window.SupabaseStorage.uploadProfilePhoto(authResult.user.id, file);
                    if(up.success && up.publicUrl){
                        photoUrl = up.publicUrl;
                        console.log('[paciente] Foto subida:', photoUrl);
                    } else {
                        console.warn('[paciente] uploadProfilePhoto falló:', up.error);
                    }
                }

                // Insert paciente con user_id y profile_photo_url
                const client = window.supabaseServiceClient || window.supabaseClient;
                const record = {
                    user_id: authResult.user.id,  // ✅ AGREGAR user_id
                    first_name: (p.name||'').split(' ')[0],
                    last_name: (p.name||'').split(' ').slice(1).join(' '),
                    email: p.email,
                    phone: p.phone || '',
                    age: p.age ? parseInt(p.age, 10) : null,
                    medical_history: p.diagnosis || p.summary || null,
                    therapist_id: p.assignedTherapist || null,
                    profile_photo_url: photoUrl,  // ✅ AGREGAR profile_photo_url
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                console.log('[paciente] Claves que se enviarán a patients:', Object.keys(record));
                let dbRes = await client.from('patients').insert([record]).select();
                if(dbRes.error){
                    console.warn('Fallo insert, intento update:', dbRes.error.message);
                    dbRes = await client.from('patients').update(record).eq('email', p.email).select();
                }
                if(dbRes.error){ throw dbRes.error; }
                console.log('[paciente] Registro en tabla patients OK con user_id y profile_photo_url');

                // Éxito UI
                if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
                if(successOverlay){ successOverlay.setAttribute('aria-hidden','false'); successOverlay.style.display='flex'; }
                pendingPatient = null;
                setTimeout(()=>{ window.location.href='../Pacientes/pacientes.html'; }, 1400);
            }catch(err){
                console.error('Error guardando paciente:', err);
                alert('Error al guardar el paciente: ' + (err && err.message ? err.message : String(err)));
                pendingPatient=null;
                if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
            }
        });
    }

    if(goToPatientsBtn){
        goToPatientsBtn.addEventListener('click', ()=>{ window.location.href='../Pacientes/pacientes.html'; });
    }

    // Cierre modal / overlays
    const modalCloseBtn = document.querySelector('#confirmModal .modal-close');
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', ()=>{ pendingPatient=null; if(confirmModal){ confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; } });
    if(confirmModal){
        confirmModal.addEventListener('click', function(ev){ if(ev.target===confirmModal){ pendingPatient=null; confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; } });
    }
    document.addEventListener('keydown', function(ev){
        if(ev.key==='Escape'){
            if(confirmModal && confirmModal.getAttribute('aria-hidden')==='false'){ pendingPatient=null; confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; }
            if(successOverlay && successOverlay.getAttribute('aria-hidden')==='false'){ successOverlay.setAttribute('aria-hidden','true'); successOverlay.style.display='none'; }
        }
    });

    // Inicialización
    populateTherapistSelect();
    setupPhotoPreview();
    window.addEventListener('therapists:updated', populateTherapistSelect);
})();
