require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const TARGET_SUPERUSER_EMAIL = (
  process.env.ADMIN_ALLOWED_EMAIL ||
  process.env.INITIAL_ADMIN_EMAIL ||
  'descomplicaclt2026@gmail.com'
)
  .trim()
  .toLowerCase();

async function listAllAuthUsers(supabaseAdmin) {
  const allUsers = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    allUsers.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }

  return allUsers;
}

async function setupSingleSuperuser() {
  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    INITIAL_ADMIN_NAME,
    INITIAL_ADMIN_PASSWORD,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env');
    process.exit(1);
  }

  if (!INITIAL_ADMIN_PASSWORD || INITIAL_ADMIN_PASSWORD.trim().length < 6) {
    console.error('Erro: Defina INITIAL_ADMIN_PASSWORD no .env (mínimo 6 caracteres) antes de executar este script.');
    process.exit(1);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('=== 1. AUDITORIA E LIMPEZA DE CONTAS ADMINISTRATIVAS ANTIGAS ===');
  const existingUsers = await listAllAuthUsers(supabaseAdmin);
  const { data: existingProfiles, error: profListErr } = await supabaseAdmin
    .from('admin_profiles')
    .select('id, auth_user_id, name, created_at');

  if (profListErr) throw profListErr;

  const profileByUserId = new Map((existingProfiles || []).map((p) => [p.auth_user_id, p]));
  let superuserAuthRecord = null;
  const removedAccounts = [];
  const nonAdminAccounts = [];

  for (const user of existingUsers) {
    const email = String(user.email || '').trim().toLowerCase();
    const linkedProfile = profileByUserId.get(user.id);

    if (email === TARGET_SUPERUSER_EMAIL) {
      superuserAuthRecord = user;
      continue;
    }

    if (linkedProfile) {
      console.log(`- Removendo conta administrativa antiga: ${email} (perfil: "${linkedProfile.name}")`);
      const { error: delProfErr } = await supabaseAdmin
        .from('admin_profiles')
        .delete()
        .eq('id', linkedProfile.id);
      if (delProfErr) throw delProfErr;

      const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (delUserErr) throw delUserErr;

      removedAccounts.push(email);
    } else {
      nonAdminAccounts.push({ id: user.id, email });
    }
  }

  // Remove perfis órfãos que não pertençam à conta única
  const { data: remainingProfiles } = await supabaseAdmin.from('admin_profiles').select('id, auth_user_id');
  for (const prof of remainingProfiles || []) {
    if (!superuserAuthRecord || prof.auth_user_id !== superuserAuthRecord.id) {
      await supabaseAdmin.from('admin_profiles').delete().eq('id', prof.id);
    }
  }

  if (nonAdminAccounts.length > 0) {
    console.warn(
      `[ATENÇÃO] Foram encontradas ${nonAdminAccounts.length} conta(s) no Supabase Auth sem vínculo com admin_profiles (mantidas por segurança para revisão manual):`,
      nonAdminAccounts.map((u) => u.email).join(', ')
    );
  }

  console.log('=== 2. CONFIGURAÇÃO DA CONTA ÚNICA DE SUPERUSUÁRIO ===');
  const superuserName = (INITIAL_ADMIN_NAME || 'Superusuário Descomplica CLT').trim();

  if (superuserAuthRecord) {
    console.log(`Atualizando credenciais e confirmação de e-mail para: ${TARGET_SUPERUSER_EMAIL}...`);
    const { data: updatedData, error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
      superuserAuthRecord.id,
      {
        email: TARGET_SUPERUSER_EMAIL,
        password: INITIAL_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { role: 'superuser', name: superuserName },
      }
    );
    if (updErr) throw updErr;
    superuserAuthRecord = updatedData.user;
  } else {
    console.log(`Criando conta única de superusuário: ${TARGET_SUPERUSER_EMAIL}...`);
    const { data: createdData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: TARGET_SUPERUSER_EMAIL,
      password: INITIAL_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'superuser', name: superuserName },
    });
    if (createErr) throw createErr;
    superuserAuthRecord = createdData.user;
  }

  const { error: upsertProfErr } = await supabaseAdmin
    .from('admin_profiles')
    .upsert(
      {
        auth_user_id: superuserAuthRecord.id,
        name: superuserName,
      },
      { onConflict: 'auth_user_id' }
    );

  if (upsertProfErr) throw upsertProfErr;

  console.log('=== 3. VERIFICAÇÃO DE INTEGRIDADE E LOGIN ===');
  const { data: finalProfiles } = await supabaseAdmin.from('admin_profiles').select('*');
  if (!finalProfiles || finalProfiles.length !== 1 || finalProfiles[0].auth_user_id !== superuserAuthRecord.id) {
    throw new Error('Falha na verificação: admin_profiles deve conter exatamente 1 superusuário.');
  }

  if (SUPABASE_ANON_KEY) {
    const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: loginTest, error: loginErr } = await supabasePublic.auth.signInWithPassword({
      email: TARGET_SUPERUSER_EMAIL,
      password: INITIAL_ADMIN_PASSWORD,
    });
    if (loginErr || !loginTest.session) {
      throw new Error(`Falha no teste de login do superusuário: ${loginErr?.message || 'sem sessão'}`);
    }
    console.log('Teste de login via Supabase Auth: OK!');
  }

  const [
    { count: subjectsCount },
    { count: questionsCount },
    { count: attemptsCount },
    { count: answersCount },
  ] = await Promise.all([
    supabaseAdmin.from('subjects').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('quiz_attempts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('quiz_answers').select('*', { count: 'exact', head: true }),
  ]);

  console.log('=== RESUMO DA OPERAÇÃO ===');
  console.log(`Contas administrativas antigas removidas: ${removedAccounts.length > 0 ? removedAccounts.join(', ') : 'Nenhuma'}`);
  console.log(`Conta única de superusuário ativa: ${TARGET_SUPERUSER_EMAIL}`);
  console.log(
    `Dados históricos preservados: ${subjectsCount || 0} temas, ${questionsCount || 0} perguntas, ${attemptsCount || 0} tentativas, ${answersCount || 0} respostas.`
  );
  process.exit(0);
}

setupSingleSuperuser().catch((err) => {
  console.error('Falha na configuração do superusuário:', err.message || err);
  process.exit(1);
});
