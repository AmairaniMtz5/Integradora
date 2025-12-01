/**
 * Alta de Terapeutas - Integración con Supabase
 * Guarda terapeutas en la base de datos
 */

(function(){
    var currentPhotoData = null;

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

    // Guardar terapeuta en Supabase
    async function saveTerapeutaToSupabase(formData){
        if (!window.supabaseServiceClient && !window.supabaseClient) {
            throw new Error('Supabase no disponible');
        }

        const client = window.supabaseServiceClient || window.supabaseClient;

        try {
            // 1. Crear usuario en Auth
            let userId = null;
            if (formData.email && formData.password) {
                const authResult = await window.SupabaseAuth.signUp({
                    email: formData.email,
                    password: formData.password,
                    fullName: formData.name,
                    role: 'therapist'
                });

                if (!authResult.success) {
                    throw new Error('Error al crear usuario: ' + authResult.error);
                }
                userId = authResult.user.id;
            }

            // 2. Crear registro en tabla therapists
            const { data, error } = await client
                .from('therapists')
                .insert([{
                    user_id: userId,
                    first_name: (formData.name || '').split(' ')[0],
                    last_name: (formData.name || '').split(' ').slice(1).join(' '),
                    specialization: formData.specialty || '',
                    phone: formData.phone || '',
                    email: formData.email || '',
                    professional_license: formData.license || '',
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) throw error;

            console.log('✅ Terapeuta guardado:', data);
            return { success: true, data: data[0] };
        } catch (err) {
            console.error('Error saving therapist:', err);
            throw err;
        }
    }

    // Setup inicial
    setupPhotoPreview();

    // Manejo del formulario
    const form = document.getElementById('adminNewTherapistForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                name: document.getElementById('name')?.value || '',
                specialty: document.getElementById('specialty')?.value || '',
                phone: document.getElementById('phone')?.value || '',
                email: document.getElementById('email')?.value || '',
                password: document.getElementById('password')?.value || '',
                license: document.getElementById('license')?.value || ''
            };

            // Validación
            if (!formData.name || !formData.email || !formData.password) {
                alert('Por favor completa nombre, email y contraseña');
                return;
            }

            try {
                const result = await saveTerapeutaToSupabase(formData);
                
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
                    window.location.href = '../terapeuta/terapeutas.html';
                }, 2000);
            } catch (err) {
                alert('Error al guardar terapeuta: ' + err.message);
            }
        });
    }

    // Exponer función globalmente para debugging
    window.saveTherapist = () => {
        if (form) form.dispatchEvent(new Event('submit'));
    };
})();
