/**
 * Supabase Patients Module
 * Handles all patient-related database operations
 */

const SupabasePatients = {
  /**
   * Create a new patient
   * @param {object} patientData - Patient information
   */
  async createPatient(patientData) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('patients')
        .insert([{
          first_name: patientData.firstName || '',
          last_name: patientData.lastName || '',
          email: patientData.email || '',
          phone: patientData.phone || '',
          date_of_birth: patientData.dateOfBirth || null,
          gender: patientData.gender || null,
          clinic: patientData.clinic || '',
          medical_history: patientData.medicalHistory || '',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error creating patient:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all patients (for admin/therapist)
   * @param {string} therapistId - Optional: filter by therapist ID
   */
  async getPatients(therapistId = null) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      let query = window.supabaseClient
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (therapistId) {
        query = query.eq('therapist_id', therapistId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting patients:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Get patient by ID
   * @param {string} patientId - Patient ID
   */
  async getPatient(patientId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, data: data || null };
    } catch (error) {
      console.error('Error getting patient:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update patient
   * @param {string} patientId - Patient ID
   * @param {object} updates - Fields to update
   */
  async updatePatient(patientId, updates) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('patients')
        .update(updates)
        .eq('id', patientId)
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error updating patient:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete patient
   * @param {string} patientId - Patient ID
   */
  async deletePatient(patientId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await window.supabaseClient
        .from('patients')
        .delete()
        .eq('id', patientId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting patient:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Assign patient to therapist
   * @param {string} patientId - Patient ID
   * @param {string} therapistId - Therapist ID
   */
  async assignToTherapist(patientId, therapistId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('patients')
        .update({ therapist_id: therapistId })
        .eq('id', patientId)
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error assigning patient to therapist:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Search patients
   * @param {string} query - Search term
   */
  async searchPatients(query) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('patients')
        .select('*')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(50);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error searching patients:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
};

window.SupabasePatients = SupabasePatients;
