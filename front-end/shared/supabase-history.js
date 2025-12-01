/**
 * Supabase History Module
 * Handles exercise history and patient progress tracking
 */

const SupabaseHistory = {
  /**
   * Create exercise history record
   * @param {object} historyData - History record information
   */
  async createHistory(historyData) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercise_history')
        .insert([{
          patient_id: historyData.patientId || null,
          exercise_id: historyData.exerciseId || null,
          therapist_id: historyData.therapistId || null,
          date_performed: historyData.datePerformed || new Date().toISOString(),
          duration_seconds: historyData.durationSeconds || 0,
          repetitions: historyData.repetitions || 0,
          notes: historyData.notes || '',
          status: historyData.status || 'completed',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error creating history record:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get patient's exercise history
   * @param {string} patientId - Patient ID
   * @param {number} limit - Number of records to retrieve
   */
  async getPatientHistory(patientId, limit = 100) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercise_history')
        .select(`
          *,
          exercises (*),
          patients (*)
        `)
        .eq('patient_id', patientId)
        .order('date_performed', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting patient history:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Get exercise history by ID
   * @param {string} historyId - History record ID
   */
  async getHistory(historyId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercise_history')
        .select(`
          *,
          exercises (*),
          patients (*)
        `)
        .eq('id', historyId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, data: data || null };
    } catch (error) {
      console.error('Error getting history:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update exercise history record
   * @param {string} historyId - History record ID
   * @param {object} updates - Fields to update
   */
  async updateHistory(historyId, updates) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercise_history')
        .update(updates)
        .eq('id', historyId)
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error updating history:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get patient exercise statistics
   * @param {string} patientId - Patient ID
   */
  async getPatientStats(patientId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercise_history')
        .select('*')
        .eq('patient_id', patientId);

      if (error) throw error;

      // Calculate statistics
      const stats = {
        totalExercises: data ? data.length : 0,
        totalMinutes: data ? data.reduce((sum, h) => sum + (h.duration_seconds || 0), 0) / 60 : 0,
        completedCount: data ? data.filter(h => h.status === 'completed').length : 0,
        skippedCount: data ? data.filter(h => h.status === 'skipped').length : 0,
        lastPerformed: data && data.length > 0 ? data[0].date_performed : null
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('Error getting patient stats:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get therapist's patient progress
   * @param {string} therapistId - Therapist ID
   */
  async getTherapistPatientsProgress(therapistId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercise_history')
        .select(`
          *,
          patients (*)
        `)
        .eq('therapist_id', therapistId)
        .order('date_performed', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting therapist patients progress:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Get history for date range
   * @param {string} patientId - Patient ID
   * @param {string} startDate - Start date (ISO format)
   * @param {string} endDate - End date (ISO format)
   */
  async getHistoryByDateRange(patientId, startDate, endDate) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercise_history')
        .select('*')
        .eq('patient_id', patientId)
        .gte('date_performed', startDate)
        .lte('date_performed', endDate)
        .order('date_performed', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting history by date range:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
};

window.SupabaseHistory = SupabaseHistory;
