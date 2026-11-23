-- ============================================================================
-- MIGRAÇÃO 006: CONTA ÚNICA DE SUPERUSUÁRIO E POLÍTICAS RLS RESTRITAS
-- Conta única autorizada: descomplicaclt2026@gmail.com
-- Preserva integralmente temas, perguntas, tentativas, resultados e configurações.
-- ============================================================================

-- 1. Remove apenas vínculos administrativos antigos de outros usuários (sem tocar em dados históricos)
DELETE FROM public.admin_profiles
WHERE auth_user_id NOT IN (
    SELECT id FROM auth.users WHERE lower(email) = 'descomplicaclt2026@gmail.com'
);

-- 2. Vincula automaticamente a conta descomplicaclt2026@gmail.com caso já exista em auth.users
INSERT INTO public.admin_profiles (auth_user_id, name)
SELECT id, 'Superusuário Descomplica CLT'
FROM auth.users
WHERE lower(email) = 'descomplicaclt2026@gmail.com'
ON CONFLICT (auth_user_id) DO UPDATE
SET name = EXCLUDED.name;

-- 3. Função de verificação estrita de superusuário para políticas RLS
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

-- 4. Impede o cadastro de qualquer segundo administrador na tabela admin_profiles
CREATE OR REPLACE FUNCTION public.enforce_single_superuser_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_email TEXT;
BEGIN
    SELECT lower(email) INTO target_email
    FROM auth.users
    WHERE id = NEW.auth_user_id;

    IF target_email IS NULL OR target_email <> 'descomplicaclt2026@gmail.com' THEN
        RAISE EXCEPTION 'Somente a conta descomplicaclt2026@gmail.com pode possuir perfil administrativo.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_superuser ON public.admin_profiles;
CREATE TRIGGER trg_enforce_single_superuser
    BEFORE INSERT OR UPDATE ON public.admin_profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_single_superuser_profile();

-- 5. Atualiza políticas RLS para exigir exclusivamente o superusuário autorizado
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
