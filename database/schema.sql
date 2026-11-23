-- ============================================================================
-- DESCOMPLICA CLT - SCHEMA COMPLETO (POSTGRESQL / SUPABASE)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Perfis Administrativos
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Matérias / Temas
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_active ON public.subjects(is_active);

-- 3. Perguntas (Com suporte a feedback geral ou individual por alternativa incorreta)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    statement TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    feedback_correct TEXT NOT NULL,
    feedback_mode TEXT NOT NULL DEFAULT 'general' CHECK (feedback_mode IN ('general', 'individual')),
    feedback_incorrect TEXT,
    feedback_incorrect_a TEXT,
    feedback_incorrect_b TEXT,
    feedback_incorrect_c TEXT,
    feedback_incorrect_d TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_subject_order ON public.questions(subject_id, display_order);
CREATE INDEX IF NOT EXISTS idx_questions_active ON public.questions(is_active);

-- 4. Tentativas de Quiz (Histórico do Aluno)
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    subject_name_snapshot TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    incorrect_answers INTEGER NOT NULL DEFAULT 0,
    unanswered_questions INTEGER NOT NULL DEFAULT 0,
    accuracy_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    question_time_snapshot INTEGER NOT NULL DEFAULT 60,
    feedback_time_snapshot INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON public.quiz_attempts(student_name);
CREATE INDEX IF NOT EXISTS idx_attempts_subject ON public.quiz_attempts(subject_id);
CREATE INDEX IF NOT EXISTS idx_attempts_started_at ON public.quiz_attempts(started_at DESC);

-- 5. Respostas Individuais (Com Snapshots para Integridade Histórica)
CREATE TABLE IF NOT EXISTS public.quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
    statement_snapshot TEXT NOT NULL,
    selected_option CHAR(1) CHECK (selected_option IN ('A', 'B', 'C', 'D') OR selected_option IS NULL),
    correct_option_snapshot CHAR(1) NOT NULL CHECK (correct_option_snapshot IN ('A', 'B', 'C', 'D')),
    feedback_snapshot TEXT,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    is_unanswered BOOLEAN NOT NULL DEFAULT FALSE,
    response_time_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_attempt ON public.quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON public.quiz_answers(question_id);

-- 6. Configurações Gerais do Sistema (Singleton ID = 1)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    question_time_seconds INTEGER NOT NULL DEFAULT 60 CHECK (question_time_seconds >= 5),
    feedback_time_seconds INTEGER NOT NULL DEFAULT 30 CHECK (feedback_time_seconds >= 3),
    inactivity_time_seconds INTEGER NOT NULL DEFAULT 90 CHECK (inactivity_time_seconds >= 10),
    inactivity_warning_seconds INTEGER NOT NULL DEFAULT 15 CHECK (inactivity_warning_seconds >= 3 AND inactivity_warning_seconds < inactivity_time_seconds),
    result_time_seconds INTEGER NOT NULL DEFAULT 60 CHECK (result_time_seconds >= 5),
    auto_timeout_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.system_settings (id, question_time_seconds, feedback_time_seconds, inactivity_time_seconds, inactivity_warning_seconds, result_time_seconds, auto_timeout_enabled)
VALUES (1, 60, 30, 90, 15, 60, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subjects_updated_at ON public.subjects;
CREATE TRIGGER trg_subjects_updated_at
    BEFORE UPDATE ON public.subjects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
CREATE TRIGGER trg_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active subjects" ON public.subjects;
CREATE POLICY "Public read active subjects"
    ON public.subjects FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public read settings" ON public.system_settings;
CREATE POLICY "Public read settings"
    ON public.system_settings FOR SELECT
    USING (TRUE);

-- Função e Políticas para conta única de superusuário (descomplicaclt2026@gmail.com)
CREATE OR REPLACE FUNCTION public.is_authorized_superuser()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        auth.uid() IS NOT NULL
        AND lower(COALESCE(auth.jwt() ->> 'email', '')) = 'descomplicaclt2026@gmail.com'
        AND EXISTS (
            SELECT 1
            FROM public.admin_profiles
            WHERE auth_user_id = auth.uid()
        );
$$;

DROP POLICY IF EXISTS "Superuser read own profile" ON public.admin_profiles;
CREATE POLICY "Superuser read own profile"
    ON public.admin_profiles FOR SELECT
    USING (public.is_authorized_superuser() AND auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins full access subjects" ON public.subjects;
CREATE POLICY "Admins full access subjects"
    ON public.subjects FOR ALL
    USING (public.is_authorized_superuser())
    WITH CHECK (public.is_authorized_superuser());

DROP POLICY IF EXISTS "Admins full access questions" ON public.questions;
CREATE POLICY "Admins full access questions"
    ON public.questions FOR ALL
    USING (public.is_authorized_superuser())
    WITH CHECK (public.is_authorized_superuser());

DROP POLICY IF EXISTS "Admins read attempts" ON public.quiz_attempts;
CREATE POLICY "Admins read attempts"
    ON public.quiz_attempts FOR SELECT
    USING (public.is_authorized_superuser());

DROP POLICY IF EXISTS "Admins read answers" ON public.quiz_answers;
CREATE POLICY "Admins read answers"
    ON public.quiz_answers FOR SELECT
    USING (public.is_authorized_superuser());

DROP POLICY IF EXISTS "Admins update settings" ON public.system_settings;
CREATE POLICY "Admins update settings"
    ON public.system_settings FOR UPDATE
    USING (public.is_authorized_superuser())
    WITH CHECK (public.is_authorized_superuser());

INSERT INTO storage.buckets (id, name, public)
VALUES ('subject-images', 'subject-images', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public view subject images" ON storage.objects;
CREATE POLICY "Public view subject images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'subject-images');
