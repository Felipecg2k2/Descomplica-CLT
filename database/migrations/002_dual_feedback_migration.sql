-- ============================================================================
-- MIGRAÇÃO 002: FEEDBACK DUPLO (ACERTO E ERRO) PRESERVANDO DADOS EXISTENTES
-- Execute este script no SQL Editor do Supabase caso já tenha criado o banco.
-- ============================================================================

-- 1. Adiciona as duas novas colunas na tabela questions sem remover explanation
ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS feedback_correct TEXT,
    ADD COLUMN IF NOT EXISTS feedback_incorrect TEXT;

-- 2. Migra dados existentes de explanation para os novos campos quando vazios,
--    garantindo que nenhuma pergunta já cadastrada perca conteúdo.
UPDATE public.questions
SET
    feedback_correct = COALESCE(NULLIF(TRIM(feedback_correct), ''), explanation),
    feedback_incorrect = COALESCE(NULLIF(TRIM(feedback_incorrect), ''), explanation)
WHERE feedback_correct IS NULL
   OR TRIM(feedback_correct) = ''
   OR feedback_incorrect IS NULL
   OR TRIM(feedback_incorrect) = '';

-- 3. Mantém explanation compatível (preenchida automaticamente se nula)
ALTER TABLE public.questions
    ALTER COLUMN explanation DROP NOT NULL;

-- 4. Adiciona snapshot do feedback exibido em quiz_answers (opcional, preserva histórico)
ALTER TABLE public.quiz_answers
    ADD COLUMN IF NOT EXISTS feedback_snapshot TEXT;
