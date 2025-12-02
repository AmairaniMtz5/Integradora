/**
 * Alta de Pacientes - Integración con Supabase
 * Guarda pacientes en la base de datos
 */

(function(){
    var currentPhotoData = null;

    // Cargar lista de terapeutas de Supabase
    async function populateTherapistSelect(){
        const select = document.getElementById('assignedTherapist');
        if(!select) return;

        try {
            const client = window.supabaseServiceClient || window.supabaseClient;
            if (!client) {
                console.warn('Supabase no disponible');
                return;
            }

            // Obtener terapeutas
            const { data: therapists, error } = await client
                .from('therapists')
                .select('*');

            if (error) {
                console.error('Error loading therapists:', error);
                return;
            }

            select.innerHTML = '';
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '(Sin asignar)';
            select.appendChild(emptyOpt);

            (therapists || []).forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.full_name || t.name;
                select.appendChild(opt);
            });
        } catch (err) {
            console.error('Error populating therapists:', err);
        }
    }

    // Gestión de foto
    function setupPhotoPreview(){
        var input = document.getElementById('photo');
        var preview = document.getElementById('photoPreview');
        if(!input || !preview) return;

        input.addEventListener('change', function(e){
            var file = e.target.files && e.target.files[0];
            if(!file){
                currentPhotoData = null;
                preview.src = '';
                preview.style.display = 'none';
                return;
            }
            var reader = new FileReader();
            reader.onload = function(ev){
                currentPhotoData = ev.target.result;
                preview.src = currentPhotoData;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
        preview.addEventListener('click', function(){ input.click(); });
    }

    // Guardar paciente en Supabase
    async function savePacientToSupabase(formData){
        if (!window.supabaseServiceClient && !window.supabaseClient) {
            throw new Error('Supabase no disponible');
        }

        const client = window.supabaseServiceClient || window.supabaseClient;

        try {
            // 1. Preparar variable para URL de foto
            let photoUrl = null;

            // 2. Crear usuario en Auth si tiene email y contraseña
            let userId = null;
            if (formData.email && formData.password) {
                const authResult = await window.SupabaseAuth.signUp({
                    email: formData.email,
                    password: formData.password,
                    fullName: formData.name,
                    role: 'patient'
                });

                if (!authResult.success) {
                    throw new Error('Error al crear usuario: ' + authResult.error);
                }
                userId = authResult.user.id;

                // 2.1 Subir foto después de crear usuario (para usar su user_id en la ruta)
                if (currentPhotoData && userId) {
                    try {
                        const response = await fetch(currentPhotoData);
                        const blob = await response.blob();
                        const timestamp = Date.now();
                        const ext = blob.type.split('/')[1] || 'jpg';
                        const fileName = `${userId}/${timestamp}-${formData.name.replace(/\s+/g, '_')}.${ext}`;
                        
                        const { data: uploadData, error: uploadError } = await client
                            .storage
                            .from('avatars')
                            .upload(fileName, blob, {
                                contentType: blob.type,
                                upsert: true
                            });

                        if (!uploadError) {
                            const { data: publicUrlData } = client
                                .storage
                                .from('avatars')
                                .getPublicUrl(fileName);
                            photoUrl = publicUrlData.publicUrl;
                            console.log('✅ Foto subida con user_id:', photoUrl);
                        } else {
                            console.error('Error subiendo foto con user_id:', uploadError);
                        }
                    } catch (err) {
                        console.error('Error procesando foto con user_id:', err);
                    }
                }
            }

            // 3. Crear registro en tabla patients
            const patientRecord = {
                user_id: userId,
                first_name: (formData.name || '').split(' ')[0],
                last_name: (formData.name || '').split(' ').slice(1).join(' '),
                phone: formData.phone || '',
                email: formData.email || '',
                age: parseInt(formData.age) || null,
                medical_history: formData.diagnosis || '',
                profile_photo_url: photoUrl,
                created_at: new Date().toISOString()
            };

            console.log('📝 Intentando guardar paciente:', patientRecord);

            let insertResult = await client
                .from('patients')
                .insert([patientRecord])
                .select();

            console.log('📊 Resultado de inserción:', { error: insertResult.error, data: insertResult.data });

            // Si falla por columnas inexistentes, quitar opcionales y reintentar
            if (insertResult.error) {
                console.warn('⚠️ Primer intento falló, reintentando con registro básico:', insertResult.error.message);
                console.error('Error completo:', insertResult.error);
                
                // Aseguramos sólo enviar columnas válidas
                delete patientRecord.medical_history;
                delete patientRecord.created_at;
                
                console.log('📝 Segundo intento con:', patientRecord);
                
                insertResult = await client
                    .from('patients')
                    .insert([patientRecord])
                    .select();
                
                console.log('📊 Resultado segundo intento:', { error: insertResult.error, data: insertResult.data });
            }

            const error = insertResult.error || null;
            const data = insertResult.data || null;

            if (error) {
                console.error('❌ Error final al guardar paciente:', error);
                throw error;
            }

            console.log('✅ Paciente guardado exitosamente:', data);
            return { success: true, data: data[0] };
        } catch (err) {
            console.error('Error saving patient:', err);
            throw err;
        }
    }

    // Setup inicial
    populateTherapistSelect();
    setupPhotoPreview();

    // Recargar terapeutas si cambian
    window.addEventListener('therapists:updated', populateTherapistSelect);

    // Manejo del formulario
    const form = document.getElementById('adminNewPatientForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                name: document.getElementById('name')?.value || '',
                age: document.getElementById('age')?.value || '',
                phone: document.getElementById('phone')?.value || '',
                email: document.getElementById('email')?.value || '',
                password: document.getElementById('password')?.value || '',
                status: document.getElementById('status')?.value || 'Activo',
                diagnosis: document.getElementById('diagnosis')?.value || '',
                assignedTherapist: document.getElementById('assignedTherapist')?.value || '',
                notes: document.getElementById('notes')?.value || ''
            };

            // Validación
            if (!formData.name || !formData.email || !formData.password) {
                alert('Por favor completa nombre, email y contraseña');
                return;
            }

            try {
                const result = await savePacientToSupabase(formData);
                
                // Mostrar éxito
                if (document.getElementById('successOverlay')) {
                    document.getElementById('successOverlay').style.display = 'flex';
                }
                
                // Limpiar formulario
                form.reset();
                currentPhotoData = null;
                const preview = document.getElementById('photoPreview');
                if (preview) preview.style.display = 'none';

                // Redirigir después de 2 segundos
                setTimeout(() => {
                    window.location.href = '../Pacientes/pacientes.html';
                }, 2000);
            } catch (err) {
                alert('Error al guardar paciente: ' + err.message);
            }
        });
    }

    // Exponer función globalmente para debugging
    window.savePatient = () => {
        if (form) form.dispatchEvent(new Event('submit'));
    };
})();
