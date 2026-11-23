-- ============================================================================
-- MIGRAÇÃO 005: ANTECEDÊNCIA CONFIGURÁVEL DO AVISO DE INATIVIDADE
-- Adiciona inactivity_warning_seconds (padrão: 15 segundos) em system_settings.
-- ============================================================================

ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS inactivity_warning_seconds INTEGER NOT NULL DEFAULT 15;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_inactivity_warning_check'
    ) THEN
        ALTER TABLE public.system_settings
            ADD CONSTRAINT system_settings_inactivity_warning_check
            CHECK (inactivity_warning_seconds >= 3 AND inactivity_warning_seconds < inactivity_time_seconds);
    END IF;
END $$;

UPDATE public.system_settings
SET inactivity_warning_seconds = LEAST(15, GREATEST(3, inactivity_time_seconds - 1))
WHERE id = 1 AND (inactivity_warning_seconds IS NULL OR inactivity_warning_seconds >= inactivity_time_seconds);
