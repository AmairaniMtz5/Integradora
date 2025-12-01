/**
 * Alta de Administradores - Integración con Supabase
 * Guarda administradores en la base de datos
 */

(function(){
    var currentPhotoData = null;

    // Verificar que sea admin
    async function checkAdminAccess(){
        try {
            const session = await window.SupabaseAuth.getSession();
            if (!session || session.user.role !== 'admin') {
                alert('Acceso denegado: Se requiere permisos de administrador');
                window.location.href = '../login/index.html';
                return false;
            }
            document.getElementById('username').textContent = session.user.email || 'Admin';
            return true;
        } catch (err) {
            console.error('Error verificando acceso:', err);
            window.location.href = '../login/index.html';
            return false;
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

    // Guardar admin en Supabase
    async function saveAdminToSupabase(formData){
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
                    role: 'admin'
                });

                if (!authResult.success) {
                    throw new Error('Error al crear usuario: ' + authResult.error);
                }
                userId = authResult.user.id;
            }

            // 2. Actualizar profile con role admin
            const { error: updateError } = await client
                .from('users')
                .update({ 
                    role: 'admin',
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            // 3. Guardar datos adicionales del admin en una tabla si existe
            // Por ahora solo guardamos en users con role admin
            
            console.log('✅ Administrador guardado:', userId);
            return { success: true, userId };
        } catch (err) {
            console.error('Error saving admin:', err);
            throw err;
        }
    }

    // Setup inicial
    async function init(){
        const hasAccess = await checkAdminAccess();
        if (!hasAccess) return;
        
        setupPhotoPreview();

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await window.SupabaseAuth.signOut();
            window.location.href = '../login/index.html';
        });
    }

    init();

    // Manejo del formulario
    const form = document.getElementById('adminNewAdminForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                name: document.getElementById('name')?.value || '',
                email: document.getElementById('email')?.value || '',
                password: document.getElementById('password')?.value || '',
                phone: document.getElementById('phone')?.value || '',
                department: document.getElementById('department')?.value || ''
            };

            // Validación
            if (!formData.name || !formData.email || !formData.password) {
                alert('Por favor completa nombre, email y contraseña');
                return;
            }

            try {
                const result = await saveAdminToSupabase(formData);
                
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
                    window.location.href = '../Dashboard/dashboard-admin.html';
                }, 2000);
            } catch (err) {
                alert('Error al guardar administrador: ' + err.message);
            }
        });
    }

    // Exponer función globalmente para debugging
    window.saveAdmin = () => {
        if (form) form.dispatchEvent(new Event('submit'));
    };
})();
