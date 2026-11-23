-- ============================================================================
-- MIGRAÇÃO 003: FEEDBACK INDIVIDUAL POR ALTERNATIVA INCORRETA
-- Preserva todas as perguntas existentes mantendo-as no modo 'general'.
-- ============================================================================

-- 1. Adiciona coluna de modo de feedback ('general' ou 'individual') e colunas individuais
ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS feedback_mode TEXT NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS feedback_incorrect_a TEXT,
    ADD COLUMN IF NOT EXISTS feedback_incorrect_b TEXT,
    ADD COLUMN IF NOT EXISTS feedback_incorrect_c TEXT,
    ADD COLUMN IF NOT EXISTS feedback_incorrect_d TEXT;

-- 2. Garante constraint válida para feedback_mode
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'questions_feedback_mode_check'
    ) THEN
        ALTER TABLE public.questions
            ADD CONSTRAINT questions_feedback_mode_check
            CHECK (feedback_mode IN ('general', 'individual'));
    END IF;
END $$;

-- 3. Permite feedback_incorrect nulo quando a questão estiver no modo 'individual'
ALTER TABLE public.questions
    ALTER COLUMN feedback_incorrect DROP NOT NULL;

-- 4. Garante que perguntas antigas tenham feedback_mode = 'general' e feedback_incorrect preenchido
UPDATE public.questions
SET
    feedback_mode = 'general',
    feedback_incorrect = COALESCE(NULLIF(TRIM(feedback_incorrect), ''), explanation)
WHERE feedback_mode IS NULL
   OR (feedback_mode = 'general' AND (feedback_incorrect IS NULL OR TRIM(feedback_incorrect) = ''));
