# Guia de Instalação, Migração e Deploy — Descomplica CLT

## 1. Atualização de Banco de Dados (Supabase)
1. Acesse o painel do seu projeto no Supabase > **SQL Editor** > **New query**.
2. Caso ainda não tenha executado as migrações anteriores, execute na ordem:
   - `database/migrations/002_dual_feedback_migration.sql`
   - `database/migrations/003_individual_option_feedback.sql`
   - `database/migrations/004_result_timer_setting.sql`
   - `database/migrations/005_inactivity_warning_setting.sql`
3. Execute **`database/migrations/006_single_superuser_rls.sql`** para ativar as políticas RLS da conta única de superusuário (`descomplicaclt2026@gmail.com`) e remover vínculos administrativos antigos, preservando todos os temas, perguntas, tentativas e resultados.
4. *(Para uma instalação do zero, execute apenas `database/schema.sql`)*.

## 2. Configuração da Conta Única de Superusuário
1. No painel do Supabase (**Authentication > Providers > Email**), mantenha **Allow new users to sign up** desabilitado para impedir cadastros públicos.
2. No seu arquivo `.env` local (ou nas variáveis de ambiente do Render), configure:
   - `ADMIN_ALLOWED_EMAIL=descomplicaclt2026@gmail.com`
   - `INITIAL_ADMIN_EMAIL=descomplicaclt2026@gmail.com`
   - `INITIAL_ADMIN_PASSWORD=<senha_definida_no_ambiente>`
3. Execute `npm run setup-superuser` (ou `npm run create-admin`). O script limpará contas administrativas antigas, criará/atualizará `descomplicaclt2026@gmail.com` no Supabase Auth com e-mail confirmado e validará o login e a integridade dos dados históricos.

## 3. Execução Local e Deploy
1. Execute `npm install` e `npm start`.
2. Acesse `http://localhost:3000/admin` e `http://localhost:3000/aluno`.
