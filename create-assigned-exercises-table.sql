-- Crear tabla assigned_exercises para almacenar ejercicios asignados a pacientes
CREATE TABLE IF NOT EXISTS public.assigned_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    patient_email TEXT,
    exercise_id TEXT NOT NULL,
    pathology TEXT,
    therapist_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    therapist_reps TEXT,
    therapist_assigned_days TEXT[],
    therapist_notes TEXT,
    assignment_week TEXT,
    therapist_assigned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_assigned_exercises_patient_id ON public.assigned_exercises(patient_id);
CREATE INDEX IF NOT EXISTS idx_assigned_exercises_patient_email ON public.assigned_exercises(patient_email);
CREATE INDEX IF NOT EXISTS idx_assigned_exercises_therapist_id ON public.assigned_exercises(therapist_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.assigned_exercises ENABLE ROW LEVEL SECURITY;

-- Política para que los terapeutas solo vean sus asignaciones
CREATE POLICY "Therapists can view their own assignments"
ON public.assigned_exercises FOR SELECT
USING (
    auth.uid() = therapist_id
    OR auth.jwt() ->> 'role' = 'admin'
);

-- Política para que los terapeutas puedan insertar asignaciones
CREATE POLICY "Therapists can insert assignments"
ON public.assigned_exercises FOR INSERT
WITH CHECK (
    auth.uid() = therapist_id
    OR auth.jwt() ->> 'role' = 'admin'
);

-- Política para que los terapeutas puedan actualizar sus asignaciones
CREATE POLICY "Therapists can update their assignments"
ON public.assigned_exercises FOR UPDATE
USING (
    auth.uid() = therapist_id
    OR auth.jwt() ->> 'role' = 'admin'
);

-- Política para que los terapeutas puedan eliminar sus asignaciones
CREATE POLICY "Therapists can delete their assignments"
ON public.assigned_exercises FOR DELETE
USING (
    auth.uid() = therapist_id
    OR auth.jwt() ->> 'role' = 'admin'
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assigned_exercises_updated_at
    BEFORE UPDATE ON public.assigned_exercises
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentar la tabla
COMMENT ON TABLE public.assigned_exercises IS 'Ejercicios asignados por terapeutas a pacientes';
COMMENT ON COLUMN public.assigned_exercises.patient_id IS 'UUID del paciente (FK a patients.id)';
COMMENT ON COLUMN public.assigned_exercises.patient_email IS 'Email del paciente (fallback para migración)';
COMMENT ON COLUMN public.assigned_exercises.exercise_id IS 'ID del ejercicio asignado';
COMMENT ON COLUMN public.assigned_exercises.pathology IS 'Patología asociada al ejercicio';
COMMENT ON COLUMN public.assigned_exercises.therapist_id IS 'UUID del terapeuta que asignó (FK a users.id)';
COMMENT ON COLUMN public.assigned_exercises.therapist_reps IS 'Repeticiones recomendadas por el terapeuta';
COMMENT ON COLUMN public.assigned_exercises.therapist_assigned_days IS 'Días de la semana asignados';
COMMENT ON COLUMN public.assigned_exercises.therapist_notes IS 'Notas del terapeuta';
COMMENT ON COLUMN public.assigned_exercises.assignment_week IS 'Semana del programa de ejercicios';
