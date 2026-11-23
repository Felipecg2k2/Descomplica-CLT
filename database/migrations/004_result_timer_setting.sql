-- ============================================================================
-- MIGRAÇÃO 004: TEMPO CONFIGURÁVEL DE EXIBIÇÃO DO RESULTADO FINAL
-- Adiciona result_time_seconds (padrão: 60 segundos) na tabela system_settings.
-- ============================================================================

ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS result_time_seconds INTEGER NOT NULL DEFAULT 60;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_result_time_check'
    ) THEN
        ALTER TABLE public.system_settings
            ADD CONSTRAINT system_settings_result_time_check
            CHECK (result_time_seconds >= 5);
    END IF;
END $$;

UPDATE public.system_settings
SET result_time_seconds = 60
WHERE id = 1 AND result_time_seconds IS NULL;
