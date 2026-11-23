const { supabaseAdmin } = require('../config/supabase');

const DEFAULT_SETTINGS = {
  id: 1,
  question_time_seconds: 60,
  feedback_time_seconds: 30,
  inactivity_time_seconds: 90,
  inactivity_warning_seconds: 15,
  result_time_seconds: 60,
  auto_timeout_enabled: true,
};

async function getSettings(req, res, next) {
  try {
    let { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('system_settings')
        .insert(DEFAULT_SETTINGS)
        .select()
        .single();
      if (insertErr) throw insertErr;
      data = inserted;
    } else if (error) {
      throw error;
    }

    const totalInactivity = data?.inactivity_time_seconds ?? DEFAULT_SETTINGS.inactivity_time_seconds;
    const rawWarning = data?.inactivity_warning_seconds ?? DEFAULT_SETTINGS.inactivity_warning_seconds;
    const safeWarning = rawWarning < totalInactivity ? rawWarning : Math.max(1, Math.min(15, totalInactivity - 1));

    res.json({
      ...DEFAULT_SETTINGS,
      ...data,
      question_time_seconds: data?.question_time_seconds ?? DEFAULT_SETTINGS.question_time_seconds,
      feedback_time_seconds: data?.feedback_time_seconds ?? DEFAULT_SETTINGS.feedback_time_seconds,
      inactivity_time_seconds: totalInactivity,
      inactivity_warning_seconds: safeWarning,
      result_time_seconds: data?.result_time_seconds ?? DEFAULT_SETTINGS.result_time_seconds,
      auto_timeout_enabled: data?.auto_timeout_enabled !== false,
    });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const {
      question_time_seconds,
      feedback_time_seconds,
      inactivity_time_seconds,
      inactivity_warning_seconds,
      result_time_seconds,
      auto_timeout_enabled,
    } = req.body;

    const qTime = parseInt(question_time_seconds, 10);
    const fTime = parseInt(feedback_time_seconds, 10);
    const iTime = parseInt(inactivity_time_seconds, 10);
    const wTime = parseInt(inactivity_warning_seconds, 10);
    const rTime = parseInt(result_time_seconds, 10);

    if (isNaN(qTime) || qTime < 5 || qTime > 600) {
      return res.status(400).json({ error: 'Tempo para responder cada questão deve estar entre 5 e 600 segundos.' });
    }
    if (isNaN(fTime) || fTime < 3 || fTime > 300) {
      return res.status(400).json({ error: 'Tempo de feedback das questões deve estar entre 3 e 300 segundos.' });
    }
    if (isNaN(iTime) || iTime < 10 || iTime > 900) {
      return res.status(400).json({ error: 'Tempo total de inatividade deve estar entre 10 e 900 segundos.' });
    }
    if (isNaN(wTime) || wTime < 3 || wTime > 300) {
      return res.status(400).json({ error: 'Antecedência do aviso de inatividade deve estar entre 3 e 300 segundos.' });
    }
    if (wTime >= iTime) {
      return res.status(400).json({
        error: 'A antecedência do aviso de inatividade deve ser menor que o tempo total de inatividade.',
      });
    }
    if (isNaN(rTime) || rTime < 5 || rTime > 600) {
      return res.status(400).json({ error: 'Tempo de exibição do resultado final deve estar entre 5 e 600 segundos.' });
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        id: 1,
        question_time_seconds: qTime,
        feedback_time_seconds: fTime,
        inactivity_time_seconds: iTime,
        inactivity_warning_seconds: wTime,
        result_time_seconds: rTime,
        auto_timeout_enabled: Boolean(auto_timeout_enabled),
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, updateSettings, DEFAULT_SETTINGS };
