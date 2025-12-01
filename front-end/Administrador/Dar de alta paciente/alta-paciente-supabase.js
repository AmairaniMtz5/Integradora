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
            // 1. Crear usuario en Auth si tiene email y contraseña
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
            }

            // 2. Crear registro en tabla patients (sin user_id porque la columna no existe en el esquema actual)
            // IMPORTANTE: la tabla NO tiene columna "diagnosis"; se usa "medical_history".
            const patientRecord = {
                first_name: (formData.name || '').split(' ')[0],
                last_name: (formData.name || '').split(' ').slice(1).join(' '),
                phone: formData.phone || '',
                email: formData.email || '',
                medical_history: formData.diagnosis || '',
                created_at: new Date().toISOString()
            };
            // Evitamos enviar columnas inexistentes (age no está en el esquema actual). Si quisieras edad, crear columna o mapear a date_of_birth.

            let insertResult = await client
                .from('patients')
                .insert([patientRecord])
                .select();

            // Si falla por columnas inexistentes, quitar opcionales y reintentar
            if (insertResult.error) {
                console.warn('Primer intento falló, reintentando con registro básico:', insertResult.error.message);
                // Aseguramos sólo enviar columnas válidas
                delete patientRecord.medical_history; // en caso extremo, se vuelve a añadir luego
                insertResult = await client
                    .from('patients')
                    .insert([patientRecord])
                    .select();
                // Restaurar medical_history si se eliminó para un siguiente flujo manual
                if (!patientRecord.medical_history && (formData.diagnosis||'').length){
                    patientRecord.medical_history = formData.diagnosis;
                }
            }

            const error = insertResult.error || null;
            const data = insertResult.data || null;

            if (error) throw error;

            console.log('✅ Paciente guardado:', data);
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
