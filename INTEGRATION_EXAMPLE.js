/**
 * EJEMPLO DE INTEGRACIÓN SUPABASE EN LOGIN.JS
 * 
 * Este archivo muestra cómo integrar Supabase en tu login.js actual
 * Reemplaza las secciones marcadas en tu archivo existente
 */

// =====================================================
// OPCIÓN 1: REEMPLAZAR LA AUTENTICACIÓN LOCAL
// =====================================================

// ANTES (usando localStorage):
// const localUser = window.localStore.authenticate(email, password, selectedRole);

// DESPUÉS (usando Supabase):
async function authenticateWithSupabase(email, password, selectedRole) {
  try {
    // Intentar autenticación con Supabase
    const result = await window.SupabaseAuth.signIn(email, password);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    // Obtener perfil del usuario
    const userProfile = await window.SupabaseAuth.getUserProfile(result.user.id);
    
    if (!userProfile) {
      return { success: false, error: 'Perfil de usuario no encontrado' };
    }
    
    // Validar que el rol coincida
    if (userProfile.role !== selectedRole) {
      return { 
        success: false, 
        error: `Este usuario es ${userProfile.role}, no ${selectedRole}`
      };
    }
    
    return {
      success: true,
      user: result.user,
      profile: userProfile,
      session: result.session
    };
  } catch (error) {
    console.error('Error en autenticación:', error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// OPCIÓN 2: INTEGRACIÓN COMPLETA EN FORM SUBMIT
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return;

  let selectedRole = 'admin';

  // Selector de rol
  const roleButtons = document.querySelectorAll('.role-btn');
  roleButtons.forEach(b =>
    b.addEventListener('click', () => {
      roleButtons.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      let r = b.getAttribute('data-role') || 'admin';
      if (r === 'therapist') r = 'terapeuta';
      selectedRole = r;
    })
  );

  // Toggle de contraseña
  const toggle = document.getElementById('togglePassword');
  const pwd = document.getElementById('password');
  if (toggle && pwd) {
    toggle.addEventListener('click', () => {
      const isPwd = pwd.type === 'password';
      pwd.type = isPwd ? 'text' : 'password';
    });
  }

  // SUBMIT DEL FORMULARIO
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showMessage('Completa email y contraseña', 'error');
      return;
    }

    try {
      showMessage('Iniciando sesión...', 'info');

      // ===== INTENTO 1: SUPABASE =====
      if (window.SupabaseConfig && window.SupabaseConfig.isConfigured()) {
        const supabaseResult = await authenticateWithSupabase(email, password, selectedRole);
        
        if (supabaseResult.success) {
          // Guardar en sessionStorage
          sessionStorage.setItem('auth_user', JSON.stringify(supabaseResult.user));
          sessionStorage.setItem('user_profile', JSON.stringify(supabaseResult.profile));
          sessionStorage.setItem('auth_session', JSON.stringify(supabaseResult.session));
          
          // También en window global
          window.__authUser = supabaseResult.user;
          window.__userProfile = supabaseResult.profile;
          window.__authSession = supabaseResult.session;
          
          showMessage('Inicio de sesión correcto. Redirigiendo...', 'success');
          
          setTimeout(() => {
            if (selectedRole === 'terapeuta' || selectedRole === 'therapist') {
              window.location.href = "/Terapeuta/Dashboard/dashboardt.html";
            } else if (selectedRole === 'admin') {
              window.location.href = "/Administrador/Dashboard/dashboard-admin.html";
            } else {
              window.location.href = "/pacientes.html"; // O página de pacientes
            }
          }, 300);
          
          return;
        }
      }

      // ===== INTENTO 2: FALLBACK A LOCALSTORAGE (OFFLINE) =====
      if (window.localStore && typeof window.localStore.authenticate === 'function') {
        const localUser = window.localStore.authenticate(email, password, selectedRole);
        
        if (localUser) {
          showMessage('Usando modo offline (local). Redirigiendo...', 'info');
          
          // Guardar localmente
          if (selectedRole === 'terapeuta') {
            window.localStore.setCurrentTherapist(localUser);
            window.__currentTherapist = localUser;
          } else {
            window.localStore.setCurrentUser(localUser);
            window.__currentUser = localUser;
          }
          
          setTimeout(() => {
            if (selectedRole === 'terapeuta') {
              window.location.href = "/Terapeuta/Dashboard/dashboardt.html";
            } else {
              window.location.href = "/Administrador/Dashboard/dashboard-admin.html";
            }
          }, 300);
          
          return;
        }
      }

      // ===== AMBOS FALLARON =====
      showMessage('Credenciales inválidas o servidor inaccesible', 'error');

    } catch (err) {
      console.error('Error en login:', err);
      showMessage('Error al iniciar sesión: ' + err.message, 'error');
    }
  });
});

function showMessage(text, type) {
  const msg = document.getElementById('loginMessage');
  if (!msg) return;
  msg.textContent = text;
  msg.style.display = 'block';
  msg.className = 'login-message ' + (type || 'info');
}

// =====================================================
// OPCIÓN 3: HELPER FUNCTIONS PARA USAR EN OTRAS PÁGINAS
// =====================================================

/**
 * Obtener usuario autenticado actual
 */
async function getCurrentAuthenticatedUser() {
  // Primero intenta de sessionStorage (más rápido)
  const stored = sessionStorage.getItem('auth_user');
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Si no está, obtén de Supabase
  return await window.SupabaseAuth.getCurrentUser();
}

/**
 * Obtener perfil del usuario actual
 */
async function getCurrentUserProfile() {
  const stored = sessionStorage.getItem('user_profile');
  if (stored) {
    return JSON.parse(stored);
  }
  
  const user = await window.SupabaseAuth.getCurrentUser();
  if (user) {
    return await window.SupabaseAuth.getUserProfile(user.id);
  }
  
  return null;
}

/**
 * Verificar si el usuario está autenticado
 */
function isUserAuthenticated() {
  const user = sessionStorage.getItem('auth_user');
  return user !== null;
}

/**
 * Cerrar sesión
 */
async function logoutUser() {
  // Limpiar sessionStorage
  sessionStorage.removeItem('auth_user');
  sessionStorage.removeItem('user_profile');
  sessionStorage.removeItem('auth_session');
  
  // Limpiar localStorage
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_session');
  localStorage.removeItem('user_profile');
  
  // Cerrar sesión en Supabase
  if (window.SupabaseAuth) {
    await window.SupabaseAuth.signOut();
  }
  
  // Redirigir a login
  window.location.href = '/Administrador/login/index.html';
}

/**
 * Proteger una página (redirigir si no está autenticado)
 */
function protectPage(requiredRole = null) {
  if (!isUserAuthenticated()) {
    window.location.href = '/Administrador/login/index.html';
    return false;
  }
  
  if (requiredRole) {
    const profile = JSON.parse(sessionStorage.getItem('user_profile') || '{}');
    if (profile.role !== requiredRole) {
      alert('No tienes permiso para acceder a esta página');
      window.location.href = '/Administrador/login/index.html';
      return false;
    }
  }
  
  return true;
}

// =====================================================
// EJEMPLO DE USO EN OTRAS PÁGINAS
// =====================================================

/*
// En dashboard-admin.html
document.addEventListener('DOMContentLoaded', async () => {
  // Proteger la página
  if (!protectPage('admin')) return;
  
  // Obtener usuario actual
  const user = await getCurrentUserProfile();
  console.log('Bienvenido, ' + user.full_name);
  
  // Cargar datos
  const result = await window.SupabasePatients.getPatients();
  if (result.success) {
    displayPatients(result.data);
  }
});

// Botón de logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (confirm('¿Deseas cerrar sesión?')) {
    logoutUser();
  }
});
*/

// =====================================================
// INTEGRACIÓN CON PACIENTES
// =====================================================

/**
 * En pacientes.html - Cargar pacientes del terapeuta actual
 */
async function loadMyPatients() {
  const profile = await getCurrentUserProfile();
  
  if (profile.role !== 'therapist') {
    console.error('Solo los terapeutas pueden ver pacientes');
    return;
  }
  
  const result = await window.SupabasePatients.getPatients(profile.id);
  
  if (result.success) {
    displayPatientsTable(result.data);
  } else {
    console.error(result.error);
  }
}

/**
 * En dashboard terapeuta - Mostrar estadísticas
 */
async function loadTherapistDashboard() {
  const profile = await getCurrentUserProfile();
  
  // Obtener pacientes
  const patientsResult = await window.SupabasePatients.getPatients(profile.id);
  
  // Obtener historial de todos los pacientes
  const progressResult = await window.SupabaseHistory.getTherapistPatientsProgress(profile.id);
  
  // Mostrar en interfaz
  document.querySelector('#totalPatients').textContent = patientsResult.data.length;
  document.querySelector('#totalExercises').textContent = progressResult.data.length;
}

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================

window.authHelpers = {
  getCurrentAuthenticatedUser,
  getCurrentUserProfile,
  isUserAuthenticated,
  logoutUser,
  protectPage,
  authenticateWithSupabase,
  loadMyPatients,
  loadTherapistDashboard
};

console.log('✓ Funciones de autenticación disponibles en window.authHelpers');
