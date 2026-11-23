const express = require('express');
const router = express.Router();
const { supabasePublic, supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');
const { requireAdmin, isAuthorizedSuperuserEmail } = require('../middleware/authMiddleware');
const { uploadImage, uploadSpreadsheet, uploadDocx } = require('../middleware/uploadMiddleware');

const {
  listAdminSubjects,
  createSubject,
  updateSubject,
  toggleSubjectStatus,
  deleteSubject,
} = require('../controllers/subjectController');

const {
  listQuestions,
  createQuestion,
  updateQuestion,
  duplicateQuestion,
  toggleQuestionStatus,
  reorderQuestions,
  deleteQuestion,
  downloadDocxTemplate,
  previewDocxImport,
  confirmDocxImport,
  previewImportQuestions,
  confirmImportQuestions,
} = require('../controllers/questionController');

const {
  getDashboardSummary,
  getAttemptsReport,
  getAttemptDetails,
  exportReports,
} = require('../controllers/reportController');

const { getSettings, updateSettings } = require('../controllers/settingsController');

// Bloqueia qualquer tentativa de cadastro público administrativo
router.post(['/signup', '/register'], (req, res) => {
  res.status(403).json({
    error: 'Cadastro público de administradores desabilitado. Utilize a conta única de superusuário.',
  });
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Permite tentativa de login somente para a conta única de superusuário autorizada
    if (!isAuthorizedSuperuserEmail(normalizedEmail)) {
      return res.status(403).json({
        error: 'Acesso não autorizado. Esta conta não possui permissão administrativa.',
      });
    }

    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.session || !data.user) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    }

    if (!isAuthorizedSuperuserEmail(data.user.email)) {
      return res.status(403).json({
        error: 'Acesso não autorizado. Apenas o superusuário oficial pode acessar este painel.',
      });
    }

    let { data: profile, error: profErr } = await supabaseAdmin
      .from('admin_profiles')
      .select('id, name')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    if (!profile) {
      const { data: createdProfile, error: createProfErr } = await supabaseAdmin
        .from('admin_profiles')
        .upsert(
          {
            auth_user_id: data.user.id,
            name: 'Superusuário Descomplica CLT',
          },
          { onConflict: 'auth_user_id' }
        )
        .select('id, name')
        .single();

      if (createProfErr) throw createProfErr;
      profile = createdProfile;
    }

    res.json({
      access_token: data.session.access_token,
      user: {
        email: data.user.email,
        name: profile.name,
        role: 'superuser',
        allowed_email: env.adminAllowedEmail,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAdmin, async (req, res) => {
  try {
    if (req.adminToken && supabaseAdmin.auth?.admin?.signOut) {
      await supabaseAdmin.auth.admin.signOut(req.adminToken);
    }
  } catch (err) {
    console.warn('[Auth] Aviso ao encerrar sessão no Supabase Auth:', err.message);
  }
  res.json({ message: 'Sessão encerrada com sucesso.' });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ user: req.adminUser });
});

router.get('/dashboard', requireAdmin, getDashboardSummary);

// Temas / Matérias
router.get('/subjects', requireAdmin, listAdminSubjects);
router.post('/subjects', requireAdmin, uploadImage.single('image'), createSubject);
router.put('/subjects/:id', requireAdmin, uploadImage.single('image'), updateSubject);
router.patch('/subjects/:id/status', requireAdmin, toggleSubjectStatus);
router.delete('/subjects/:id', requireAdmin, deleteSubject);

// Perguntas
router.get('/questions', requireAdmin, listQuestions);
router.post('/questions', requireAdmin, createQuestion);
router.put('/questions/reorder', requireAdmin, reorderQuestions);
router.put('/questions/:id', requireAdmin, updateQuestion);
router.post('/questions/:id/duplicate', requireAdmin, duplicateQuestion);
router.patch('/questions/:id/status', requireAdmin, toggleQuestionStatus);
router.delete('/questions/:id', requireAdmin, deleteQuestion);

// Modelo e Importação via Word (.docx)
router.get('/questions/import/template-docx', requireAdmin, downloadDocxTemplate);
router.post('/questions/import/docx/preview', requireAdmin, uploadDocx.single('file'), previewDocxImport);
router.post('/questions/import/docx/confirm', requireAdmin, confirmDocxImport);

// Importação via Planilha (.xlsx / .csv)
router.post('/questions/import/preview', requireAdmin, uploadSpreadsheet.single('file'), previewImportQuestions);
router.post('/questions/import/confirm', requireAdmin, confirmImportQuestions);

// Resultados e Relatórios
router.get('/reports', requireAdmin, getAttemptsReport);
router.get('/reports/export', requireAdmin, exportReports);
router.get('/reports/:id', requireAdmin, getAttemptDetails);

// Configurações
router.get('/settings', requireAdmin, getSettings);
router.put('/settings', requireAdmin, updateSettings);

module.exports = router;
