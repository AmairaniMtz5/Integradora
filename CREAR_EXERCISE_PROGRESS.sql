-- Tabla de progreso detallado de ejercicios
-- Registra cada sesión individual con métricas granulares (good_reps, bad_reps, duración, objetivos)
-- Soporta datos del terapeuta (días, semana, notas) y métricas JSON del servidor

create table if not exists public.exercise_progress (
  id bigint generated always as identity primary key,
  patient_id uuid references public.patients(id) on delete cascade not null,
  exercise_id text not null,
  exercise_name text not null,
  pathology text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer,
  target_reps integer,
  target_seconds integer,
  completed_reps integer default 0,
  good_reps integer default 0,
  bad_reps integer default 0,
  completed boolean,
  therapist_days text[] null,
  therapist_week text null,
  therapist_notes text null,
  metrics jsonb null,
  created_at timestamptz default now()
);

-- Índices para mejorar queries de reportes
create index if not exists idx_exercise_progress_patient on public.exercise_progress(patient_id);
create index if not exists idx_exercise_progress_started_at on public.exercise_progress(started_at desc);
create index if not exists idx_exercise_progress_week on public.exercise_progress(therapist_week) where therapist_week is not null;

-- Habilitar RLS
alter table public.exercise_progress enable row level security;

-- Política: Pacientes leen y crean sus propios registros
create policy ep_patient_select on public.exercise_progress
  for select using (
    auth.uid() = (select user_id from public.patients p where p.id = exercise_progress.patient_id)
  );

create policy ep_patient_insert on public.exercise_progress
  for insert with check (
    auth.uid() = (select user_id from public.patients p where p.id = exercise_progress.patient_id)
  );

-- Política: Terapeutas leen registros de sus pacientes (a través de assigned_exercises)
create policy ep_therapist_select on public.exercise_progress
  for select using (
    exists (
      select 1
      from public.therapists t
      join public.assigned_exercises ae on ae.therapist_id = t.id
      where t.user_id = auth.uid()
        and ae.patient_id = exercise_progress.patient_id
    )
  );

-- Comentarios descriptivos
comment on table public.exercise_progress is 'Historial granular de sesiones de ejercicios con conteo de repeticiones correctas/incorrectas';
comment on column public.exercise_progress.good_reps is 'Repeticiones evaluadas como correctas por el modelo';
comment on column public.exercise_progress.bad_reps is 'Repeticiones evaluadas como incorrectas';
comment on column public.exercise_progress.completed is 'TRUE si se alcanzó target_reps (si definido)';
comment on column public.exercise_progress.metrics is 'JSON con métricas adicionales del servidor (distancias, confianza, etc.)';
