import { supabase } from '../supabaseClient';

/**
 * Guarda una sesión de ejercicios en la base de datos
 * @param {Object} sessionData - Datos de la sesión
 * @param {number} sessionData.completed_exercises - Ejercicios completados
 * @param {number} sessionData.total_exercises - Total de ejercicios
 * @param {number} sessionData.errors - Errores cometidos
 * @param {number} sessionData.repetitions - Repeticiones totales
 * @param {number} sessionData.skipped_exercises - Ejercicios omitidos
 * @param {string} sessionData.pathology - Patología del paciente
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveExerciseSession(sessionData) {
  try {
    // Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Usuario no autenticado, no se guardará el historial');
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Buscar el patient_id asociado al usuario
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (patientError || !patientData) {
      console.log('Paciente no encontrado, no se guardará el historial');
      return { success: false, error: 'Paciente no encontrado' };
    }

    // Insertar registro en exercise_history
    const { error: insertError } = await supabase
      .from('exercise_history')
      .insert({
        patient_id: patientData.id,
        date_performed: new Date().toISOString(),
        repetitions: sessionData.repetitions || 0,
        duration_seconds: sessionData.duration_seconds || 0,
        status: sessionData.completed_exercises > 0 ? 'completed' : 'skipped',
        notes: `Completados: ${sessionData.completed_exercises}/${sessionData.total_exercises}, Errores: ${sessionData.errors}`,
      });

    if (insertError) {
      console.error('Error guardando historial:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log('Historial guardado exitosamente');
    return { success: true };

  } catch (err) {
    console.error('Error en saveExerciseSession:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Guarda un progreso detallado de un ejercicio
 * @param {Object} progress
 * @param {string} progress.exercise_id
 * @param {string} progress.exercise_name
 * @param {string} progress.pathology
 * @param {number} progress.started_at_ts - epoch ms
 * @param {number} progress.ended_at_ts - epoch ms
 * @param {number} [progress.target_reps]
 * @param {number} [progress.target_seconds]
 * @param {number} progress.completed_reps
 * @param {number} progress.good_reps
 * @param {number} progress.bad_reps
 * @param {boolean} progress.completed
 * @param {string[]} [progress.days]
 * @param {string} [progress.week]
 * @param {string} [progress.notes]
 * @param {Object} [progress.metrics]
 */
export async function saveExerciseProgress(progress) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: 'Usuario no autenticado' };

    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (patientError || !patientData) return { success: false, error: 'Paciente no encontrado' };

    // Inserta en una tabla flexible pensada para reportes
    const payload = {
      patient_id: patientData.id,
      exercise_id: progress.exercise_id,
      exercise_name: progress.exercise_name,
      pathology: progress.pathology,
      started_at: new Date(progress.started_at_ts).toISOString(),
      ended_at: new Date(progress.ended_at_ts).toISOString(),
      duration_seconds: Math.max(0, Math.round((progress.ended_at_ts - progress.started_at_ts) / 1000)),
      target_reps: progress.target_reps ?? null,
      target_seconds: progress.target_seconds ?? null,
      completed_reps: progress.completed_reps ?? 0,
      good_reps: progress.good_reps ?? 0,
      bad_reps: progress.bad_reps ?? 0,
      completed: !!progress.completed,
      therapist_days: progress.days ?? null,
      therapist_week: progress.week ?? null,
      therapist_notes: progress.notes ?? null,
      metrics: progress.metrics ?? null,
    };

    const { error: insertError } = await supabase
      .from('exercise_progress')
      .insert(payload);

    if (insertError) return { success: false, error: insertError.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Obtiene el perfil del paciente actual
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getPatientProfile() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Obtiene el historial de ejercicios del paciente
 * @param {number} limit - Número máximo de registros a obtener
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getExerciseHistory(limit = 10) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (patientError || !patientData) {
      return { success: false, error: 'Paciente no encontrado' };
    }

    const { data, error } = await supabase
      .from('exercise_history')
      .select('*')
      .eq('patient_id', patientData.id)
      .order('date_performed', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };

  } catch (err) {
    return { success: false, error: err.message };
  }
}
