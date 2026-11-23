require('dotenv').config();

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.warn(`[AVISO] Variáveis de ambiente ausentes: ${missing.join(', ')}`);
}

const allowedSuperuserEmail = (
  process.env.ADMIN_ALLOWED_EMAIL ||
  process.env.INITIAL_ADMIN_EMAIL ||
  'descomplicaclt2026@gmail.com'
)
  .trim()
  .toLowerCase();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'subject-images',
  adminAllowedEmail: allowedSuperuserEmail,
};
