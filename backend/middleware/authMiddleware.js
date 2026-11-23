const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');

function isAuthorizedSuperuserEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase() === env.adminAllowedEmail;
}

async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || !token.trim()) {
      return res.status(401).json({ error: 'Token de autenticação inválido.' });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    // Valida conta única de superusuário autorizada
    if (!isAuthorizedSuperuserEmail(user.email)) {
      return res.status(403).json({
        error: 'Acesso negado. Apenas a conta de superusuário autorizada pode acessar o painel administrativo.',
      });
    }

    // Verifica vínculo ativo na tabela admin_profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('admin_profiles')
      .select('id, name')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Acesso negado. Perfil administrativo não encontrado.' });
    }

    req.adminToken = token;
    req.adminUser = {
      id: user.id,
      email: user.email,
      profileId: profile.id,
      name: profile.name,
      role: 'superuser',
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin, isAuthorizedSuperuserEmail };
