/**
 * Supabase Therapists Module
 * Handles all therapist-related database operations
 */

const SupabaseTherapists = {
  /**
   * Create a new therapist
   * @param {object} therapistData - Therapist information
   */
  async createTherapist(therapistData) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('therapists')
        .insert([{
          first_name: therapistData.firstName || '',
          last_name: therapistData.lastName || '',
          email: therapistData.email || '',
          phone: therapistData.phone || '',
          clinic: therapistData.clinic || '',
          specialization: therapistData.specialization || '',
          professional_license: therapistData.professionalLicense || '',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error creating therapist:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all therapists
   */
  async getTherapists() {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('therapists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting therapists:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Get therapist by ID
   * @param {string} therapistId - Therapist ID
   */
  async getTherapist(therapistId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('therapists')
        .select('*')
        .eq('id', therapistId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, data: data || null };
    } catch (error) {
      console.error('Error getting therapist:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update therapist
   * @param {string} therapistId - Therapist ID
   * @param {object} updates - Fields to update
   */
  async updateTherapist(therapistId, updates) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('therapists')
        .update(updates)
        .eq('id', therapistId)
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error updating therapist:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete therapist
   * @param {string} therapistId - Therapist ID
   */
  async deleteTherapist(therapistId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await window.supabaseClient
        .from('therapists')
        .delete()
        .eq('id', therapistId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting therapist:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get therapist's patients
   * @param {string} therapistId - Therapist ID
   */
  async getTherapistPatients(therapistId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('patients')
        .select('*')
        .eq('therapist_id', therapistId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting therapist patients:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Search therapists
   * @param {string} query - Search term
   */
  async searchTherapists(query) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('therapists')
        .select('*')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,specialization.ilike.%${query}%`)
        .limit(50);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error searching therapists:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
};

window.SupabaseTherapists = SupabaseTherapists;
