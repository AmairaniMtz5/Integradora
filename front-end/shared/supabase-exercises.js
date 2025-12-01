/**
 * Supabase Exercises Module
 * Handles all exercise and pathology-related database operations
 */

const SupabaseExercises = {
  /**
   * Create a new pathology
   * @param {object} pathologyData - Pathology information
   */
  async createPathology(pathologyData) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('pathologies')
        .insert([{
          name: pathologyData.name || '',
          description: pathologyData.description || '',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error creating pathology:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all pathologies
   */
  async getPathologies() {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('pathologies')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting pathologies:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Create a new exercise
   * @param {object} exerciseData - Exercise information
   */
  async createExercise(exerciseData) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercises')
        .insert([{
          name: exerciseData.name || '',
          description: exerciseData.description || '',
          pathology_id: exerciseData.pathologyId || null,
          video_url: exerciseData.videoUrl || '',
          video_path: exerciseData.videoPath || '',
          instructions: exerciseData.instructions || '',
          duration_minutes: exerciseData.durationMinutes || 0,
          difficulty_level: exerciseData.difficultyLevel || 'beginner',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error creating exercise:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all exercises
   */
  async getExercises() {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercises')
        .select(`
          *,
          pathologies (*)
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting exercises:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Get exercises by pathology
   * @param {string} pathologyId - Pathology ID
   */
  async getExercisesByPathology(pathologyId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercises')
        .select('*')
        .eq('pathology_id', pathologyId)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting exercises by pathology:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  /**
   * Get exercise by ID
   * @param {string} exerciseId - Exercise ID
   */
  async getExercise(exerciseId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercises')
        .select(`
          *,
          pathologies (*)
        `)
        .eq('id', exerciseId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, data: data || null };
    } catch (error) {
      console.error('Error getting exercise:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update exercise
   * @param {string} exerciseId - Exercise ID
   * @param {object} updates - Fields to update
   */
  async updateExercise(exerciseId, updates) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercises')
        .update(updates)
        .eq('id', exerciseId)
        .select();

      if (error) throw error;
      return { success: true, data: data ? data[0] : null };
    } catch (error) {
      console.error('Error updating exercise:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete exercise
   * @param {string} exerciseId - Exercise ID
   */
  async deleteExercise(exerciseId) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await window.supabaseClient
        .from('exercises')
        .delete()
        .eq('id', exerciseId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting exercise:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Search exercises
   * @param {string} query - Search term
   */
  async searchExercises(query) {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('exercises')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(50);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error searching exercises:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
};

window.SupabaseExercises = SupabaseExercises;
