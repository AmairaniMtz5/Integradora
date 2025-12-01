/**
 * Supabase Client Configuration
 * Initialize and export Supabase client for the entire application
 */

// IMPORTANTE: Reemplaza estos valores con tus credenciales de Supabase
const SUPABASE_URL = 'https://wzfhosbyokruukbaboct.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Zmhvc2J5b2tydXVrYmFib2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjgzOTUsImV4cCI6MjA3OTk0NDM5NX0.OWUWzyPDrSJfkB0WUo2gjIsG6TEhPL578Ya_Z8o_PH0';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Zmhvc2J5b2tydXVrYmFib2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM2ODM5NSwiZXhwIjoyMDc5OTQ0Mzk1fQ.ujkaag-Vi10MqEElHtN4eCnZqdSsv-lNw_OoX4wPxmw';

// Validar que las credenciales están configuradas
if (SUPABASE_URL === 'https://YOUR_PROJECT_ID.supabase.co' || SUPABASE_ANON_KEY === 'YOUR_ANON_KEY') {
  console.warn('⚠️ Supabase credentials not configured. Please update SUPABASE_URL and SUPABASE_ANON_KEY in supabase-client.js');
}

/**
 * Initialize Supabase client
 * This uses the supabase-js library (must be included via CDN or npm)
 */
function initSupabaseClient(storageKey) {
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded. Please include supabase-js via CDN or npm');
    return null;
  }

  try {
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: storageKey || 'sb-anon',
      }
    });
    console.log('✓ Supabase client initialized successfully');
    return client;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

// Initialize per-role clients with distinct storage keys to allow concurrent sessions
const supabaseClientAdmin = initSupabaseClient('sb-admin');
const supabaseClientTherapist = initSupabaseClient('sb-therapist');

// Default client selection based on path (keeps existing code working without refactors)
let supabaseClient = supabaseClientAdmin;
try {
  const path = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
  if (path.includes('/terapeuta/')) {
    supabaseClient = supabaseClientTherapist || supabaseClientAdmin;
  } else if (path.includes('/administrador/')) {
    supabaseClient = supabaseClientAdmin || supabaseClientTherapist;
  }
} catch(_) { /* noop */ }

// Expose globally
window.supabaseClientAdmin = supabaseClientAdmin;
window.supabaseClientTherapist = supabaseClientTherapist;
window.supabaseClient = supabaseClient;

// Initialize service role client for admin operations
function initServiceRoleClient() {
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded');
    return null;
  }

  try {
    // Nota: El service role no debería usarse en el navegador en producción.
    // Para evitar conflictos de sesión, no persistimos ni auto-refrescamos.
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'sb-service',
      }
    });
    console.log('✓ Supabase service role client initialized');
    return client;
  } catch (error) {
    console.error('Failed to initialize service role client:', error);
    return null;
  }
}

const supabaseServiceClient = initServiceRoleClient();
window.supabaseServiceClient = supabaseServiceClient;

/**
 * Configuration object
 */
const SupabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  client: supabaseClient,

  /**
   * Check if Supabase is properly configured
   */
  isConfigured() {
    return this.client !== null && 
           this.url !== 'https://YOUR_PROJECT_ID.supabase.co' &&
           this.anonKey !== 'YOUR_ANON_KEY';
  },

  /**
   * Get the current session
   */
  async getSession() {
    if (!this.client) return null;
    try {
      const { data } = await this.client.auth.getSession();
      return data.session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  /**
   * Get the current user
   */
  async getCurrentUser() {
    if (!this.client) return null;
    try {
      const { data: { user } } = await this.client.auth.getUser();
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }
};

window.SupabaseConfig = SupabaseConfig;
