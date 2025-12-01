/**
 * Supabase Authentication Module
 * Handles user authentication (admin, therapist, patient)
 */

const SupabaseAuth = {
  /**
   * Sign up a new user
   * @param {object} options - Signup options: { email, password, fullName, role, clinic, phone }
   */
  async signUp(options = {}) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { email, password, fullName, role, clinic, phone } = options;

      if (!email || !password) {
        throw new Error('Email y contraseña son requeridos');
      }

      console.log('📝 Enviando signup con:', { email, password: '***', fullName, role });

      // SignUp incluyendo metadata (full_name, role, clinic)
      const { data, error } = await window.supabaseClient.auth.signUp({
        email: String(email).trim(),
        password: String(password).trim(),
        options: {
          data: {
            full_name: fullName || '',
            role: role || 'patient',
            clinic: clinic || ''
          }
        }
      });

      if (error) {
        console.error('Supabase signup error:', error);
        // If user already registered, try to sign in instead
        if (error.message && error.message.includes('already registered')) {
          console.log('📧 Usuario ya existe, intentando signin...');
          try {
            const signInResult = await this.signIn(email, password);
            if (signInResult.success) {
              console.log('✅ Usuario autenticado existente');
              return { success: true, user: signInResult.user, session: signInResult.session };
            }
          } catch (signInError) {
            console.error('Sign in failed for existing user:', signInError);
          }
        }
        throw error;
      }

      console.log('✅ Usuario creado en auth:', data.user?.id, 'metadata:', data.user?.user_metadata);

      // Store user metadata in users table AFTER auth creation
      if (data.user) {
        try {
          await this.createUserProfile(data.user.id, email, {
            fullName: fullName || '',
            role: role || 'patient',
            clinic: clinic || '',
            phone: phone || ''
          });
          console.log('✅ Perfil creado en tabla users');
        } catch (profileError) {
          console.warn('Aviso al crear perfil:', profileError.message);
        }
      }

      // Intentar hacer signin automático para obtener sesión
      // Esto funciona incluso si el email no está confirmado en algunos casos
      try {
        const signInResult = await this.signIn(email, password);
        if (signInResult.success) {
          return { success: true, user: data.user, session: signInResult.session };
        }
      } catch (signInError) {
        console.warn('Auto-signin después del signup no fue posible:', signInError.message);
        // Continuar de todas formas - el usuario fue creado
      }

      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      console.error('Sign up failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Sign in with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} role - User role ('admin' or 'therapist')
   */
  async signIn(email, password, role = 'admin') {
    // Select correct client based on role
    const client = role === 'therapist' ? window.supabaseClientTherapist : window.supabaseClientAdmin;
    if (!client) {
      throw new Error('Supabase client not initialized for role: ' + role);
    }

    try {
      console.log('🔐 Intentando signin con:', email, 'role:', role);
      
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ Auth error:', error);
        throw error;
      }

      console.log('✅ Auth exitoso, obteniendo perfil...');

      // Get user profile to determine role
      const profile = await this.getUserProfile(data.user.id);
      
      if (!profile) {
        console.warn('⚠️ No se encontró perfil para usuario:', data.user.id);
      }

      // Store in window for easy access
      window.__authUser = data.user;
      window.__authSession = data.session;
      
      // Store locally for offline access
      if (localStorage) {
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        localStorage.setItem('auth_session', JSON.stringify(data.session));
        if (profile) {
          localStorage.setItem('user_profile', JSON.stringify(profile));
        }
      }

      console.log('✅ Signin completado:', { userId: data.user.id, role: profile?.role });

      return {
        success: true,
        user: data.user,
        session: data.session,
        profile: profile
      };
    } catch (error) {
      console.error('Sign in failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Sign out current user
   */
  async signOut() {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await window.supabaseClient.auth.signOut();
      if (error) throw error;

      // Clear local storage
      window.__authUser = null;
      window.__authSession = null;
      if (localStorage) {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_session');
        localStorage.removeItem('user_profile');
      }

      return { success: true };
    } catch (error) {
      console.error('Sign out failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Create user profile in users table
   * @param {string} userId - Auth user ID
   * @param {string} email - User email
   * @param {object} metadata - User metadata
   */
  async createUserProfile(userId, email, metadata = {}) {
    const client = window.supabaseServiceClient || window.supabaseClient;
    if (!client) return null;
    try {
      // Insert sin photo_url (columna puede no existir). Se añadirá luego si se crea.
      const insertData = {
        id: userId,
        email,
        full_name: metadata.fullName || metadata.name || '',
        role: metadata.role || 'patient',
        clinic: metadata.clinic || '',
        phone: metadata.phone || '',
        professional_license: metadata.professional_license || null,
        created_at: new Date().toISOString()
      };
      const { data, error } = await client.from('users').insert([insertData]).select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      // Si la tabla ya tiene RLS estricta o conflicto, continuar sin bloquear signup
      console.warn('Perfil no creado (continuará).', error.message);
      return null;
    }
  },

  /**
   * Get user profile
   * @param {string} userId - Auth user ID
   */
  async getUserProfile(userId) {
    if (!window.supabaseClient) return null;

    try {
      const { data, error } = await window.supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  },

  /**
   * Update user profile
   * @param {string} userId - Auth user ID
   * @param {object} updates - Fields to update
   */
  async updateUserProfile(userId, updates) {
    const client = window.supabaseServiceClient || window.supabaseClient;
    if (!client) return null;
    try {
      // Si incluye photo_url y la columna no existe se capturará el error 42703
      const { data, error } = await client.from('users').update(updates).eq('id', userId).select();
      if (error) {
        if (error.code === '42703') {
          console.warn('[SupabaseAuth.updateUserProfile] columna photo_url no existe, omitiendo actualización de foto');
          // reintentar sin photo_url
          const clean = Object.assign({}, updates);
          delete clean.photo_url;
          const { data: data2, error: err2 } = await client.from('users').update(clean).eq('id', userId).select();
          if (err2) throw err2;
          return data2 ? data2[0] : null;
        }
        throw error;
      }
      return data ? data[0] : null;
    } catch (error) {
      console.warn('updateUserProfile fallo:', error.message);
      return null;
    }
  },

  async refreshSession(){
    try {
      const { data } = await window.supabaseClient.auth.getUser();
      console.log('[SupabaseAuth.refreshSession] user metadata now:', data?.user?.user_metadata);
      return data?.user || null;
    }catch(e){ console.warn('refreshSession failed', e.message); return null; }
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    if (!window.supabaseClient) return null;

    try {
      const { data: { user }, error } = await window.supabaseClient.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  /**
   * Reset password
   * @param {string} email - User email
   */
  async resetPassword(email) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Password reset failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get current session
   */
  async getSession() {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      
      if (!data.session) {
        return null;
      }

      // Get user profile from users table
      const { data: profile, error: profileError } = await window.supabaseClient
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (profileError) {
        console.warn('Could not load user profile:', profileError);
        return { user: data.session.user };
      }

      return { 
        user: { 
          ...data.session.user, 
          role: profile.role,
          full_name: profile.full_name,
          email: profile.email
        },
        session: data.session
      };
    } catch (error) {
      console.error('Get session failed:', error);
      return null;
    }
  },

  /**
   * Update password
   * @param {string} newPassword - New password
   */
  async updatePassword(newPassword) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await window.supabaseClient.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update password failed:', error);
      return { success: false, error: error.message };
    }
  }
};

window.SupabaseAuth = SupabaseAuth;
