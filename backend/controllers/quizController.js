const { supabaseAdmin } = require('../config/supabase');

async function startQuizAttempt(req, res, next) {
  try {
    const { student_name, subject_id } = req.body;

    if (!student_name || student_name.trim().length < 2) {
      return res.status(400).json({ error: 'Por favor, informe seu nome completo para iniciar.' });
    }
    if (!subject_id) {
      return res.status(400).json({ error: 'Selecione um tema válido.' });
    }

    const { data: subject, error: subjErr } = await supabaseAdmin
      .from('subjects')
      .select('id, name, description, is_active')
      .eq('id', subject_id)
      .single();

    if (subjErr || !subject || !subject.is_active) {
      return res.status(404).json({ error: 'Tema não encontrado ou indisponível no momento.' });
    }

    const { data: questions, error: qErr } = await supabaseAdmin
      .from('questions')
      .select('id, statement, option_a, option_b, option_c, option_d, display_order')
      .eq('subject_id', subject_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (qErr) throw qErr;

    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'Este tema ainda não possui perguntas ativas cadastradas.' });
    }

    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .single();

    const questionTime = settings?.question_time_seconds ?? 60;
    const feedbackTime = settings?.feedback_time_seconds ?? 30;
    const inactivityTime = settings?.inactivity_time_seconds ?? 90;
    const rawWarningTime = settings?.inactivity_warning_seconds ?? 15;
    const inactivityWarningTime = rawWarningTime < inactivityTime ? rawWarningTime : Math.max(1, Math.min(15, inactivityTime - 1));
    const resultTime = settings?.result_time_seconds ?? 60;
    const autoTimeoutEnabled = settings ? settings.auto_timeout_enabled !== false : true;

    const { data: attempt, error: attErr } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({
        student_name: student_name.trim(),
        subject_id: subject.id,
        subject_name_snapshot: subject.name,
        total_questions: questions.length,
        question_time_snapshot: questionTime,
        feedback_time_snapshot: feedbackTime,
        status: 'in_progress',
      })
      .select()
      .single();

    if (attErr) throw attErr;

    res.status(201).json({
      attempt,
      subject: {
        id: subject.id,
        name: subject.name,
        description: subject.description,
      },
      questions,
      timers: {
        question_time_seconds: questionTime,
        feedback_time_seconds: feedbackTime,
        inactivity_time_seconds: inactivityTime,
        inactivity_warning_seconds: inactivityWarningTime,
        result_time_seconds: resultTime,
        auto_timeout_enabled: autoTimeoutEnabled,
      },
    });
  } catch (err) {
    next(err);
  }
}

function resolveFeedbackForOutcome(question, isCorrect, isUnanswered, selectedOption) {
  const fbCorrect = (question.feedback_correct || question.explanation || '').trim();
  const fbGeneralIncorrect = (question.feedback_incorrect || question.explanation || '').trim();
  const mode = question.feedback_mode === 'individual' ? 'individual' : 'general';

  if (isCorrect) {
    return fbCorrect;
  }

  // Quando o tempo acabar (não resposta), nunca exibe feedback individual de uma alternativa não selecionada
  if (isUnanswered) {
    if (fbGeneralIncorrect) {
      return fbGeneralIncorrect;
    }
    const correctText = question[`option_${question.correct_option.toLowerCase()}`] || '';
    return `O tempo para responder esta questão acabou antes que uma alternativa fosse selecionada. A alternativa correta é ${question.correct_option}) ${correctText}. ${fbCorrect}`.trim();
  }

  // Quando o aluno respondeu incorretamente
  if (mode === 'individual' && selectedOption) {
    const optKey = `feedback_incorrect_${String(selectedOption).trim().toLowerCase()}`;
    const specificFeedback = (question[optKey] || '').trim();
    if (specificFeedback) {
      return specificFeedback;
    }
  }

  return fbGeneralIncorrect || fbCorrect;
}

async function submitQuestionAnswer(req, res, next) {
  try {
    const { attemptId } = req.params;
    const { question_id, selected_option, is_timeout, response_time_seconds } = req.body;

    if (!question_id) {
      return res.status(400).json({ error: 'ID da pergunta é obrigatório.' });
    }

    const { data: attempt, error: attErr } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (attErr || !attempt) {
      return res.status(404).json({ error: 'Tentativa não encontrada.' });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: 'Esta tentativa já foi encerrada.' });
    }

    const { data: question, error: qErr } = await supabaseAdmin
      .from('questions')
      .select(
        'id, statement, option_a, option_b, option_c, option_d, correct_option, feedback_correct, feedback_mode, feedback_incorrect, feedback_incorrect_a, feedback_incorrect_b, feedback_incorrect_c, feedback_incorrect_d, explanation'
      )
      .eq('id', question_id)
      .single();

    if (qErr || !question) {
      return res.status(404).json({ error: 'Pergunta não encontrada.' });
    }

    const { data: existingAnswer } = await supabaseAdmin
      .from('quiz_answers')
      .select('*')
      .eq('attempt_id', attemptId)
      .eq('question_id', question_id)
      .maybeSingle();

    if (existingAnswer) {
      const resolvedFb =
        existingAnswer.feedback_snapshot ||
        resolveFeedbackForOutcome(
          question,
          existingAnswer.is_correct,
          existingAnswer.is_unanswered,
          existingAnswer.selected_option
        );

      return res.json({
        already_answered: true,
        is_correct: existingAnswer.is_correct,
        is_unanswered: existingAnswer.is_unanswered,
        selected_option: existingAnswer.selected_option,
        selected_option_text: existingAnswer.selected_option
          ? question[`option_${existingAnswer.selected_option.toLowerCase()}`]
          : null,
        correct_option: question.correct_option,
        correct_option_text: question[`option_${question.correct_option.toLowerCase()}`],
        feedback_text: resolvedFb,
        explanation: resolvedFb,
      });
    }

    const unanswered = Boolean(is_timeout) || !selected_option;
    const normalizedSelected = unanswered ? null : String(selected_option).trim().toUpperCase();

    if (!unanswered && !['A', 'B', 'C', 'D'].includes(normalizedSelected)) {
      return res.status(400).json({ error: 'Alternativa inválida.' });
    }

    const isCorrect = !unanswered && normalizedSelected === question.correct_option;
    const feedbackText = resolveFeedbackForOutcome(question, isCorrect, unanswered, normalizedSelected);

    const { error: insertErr } = await supabaseAdmin
      .from('quiz_answers')
      .insert({
        attempt_id: attemptId,
        question_id: question.id,
        statement_snapshot: question.statement,
        selected_option: normalizedSelected,
        correct_option_snapshot: question.correct_option,
        feedback_snapshot: feedbackText,
        is_correct: isCorrect,
        is_unanswered: unanswered,
        response_time_seconds: typeof response_time_seconds === 'number' ? Math.max(0, Math.round(response_time_seconds)) : null,
      });

    if (insertErr) throw insertErr;

    const { data: allAnswers } = await supabaseAdmin
      .from('quiz_answers')
      .select('is_correct, is_unanswered')
      .eq('attempt_id', attemptId);

    const correctCount = (allAnswers || []).filter((a) => a.is_correct).length;
    const unansweredCount = (allAnswers || []).filter((a) => a.is_unanswered).length;
    const incorrectCount = (allAnswers || []).filter((a) => !a.is_correct && !a.is_unanswered).length;
    const accuracy = attempt.total_questions > 0
      ? Number(((correctCount / attempt.total_questions) * 100).toFixed(2))
      : 0;

    await supabaseAdmin
      .from('quiz_attempts')
      .update({
        correct_answers: correctCount,
        incorrect_answers: incorrectCount,
        unanswered_questions: unansweredCount,
        accuracy_percentage: accuracy,
      })
      .eq('id', attemptId);

    res.json({
      is_correct: isCorrect,
      is_unanswered: unanswered,
      selected_option: normalizedSelected,
      selected_option_text: normalizedSelected
        ? question[`option_${normalizedSelected.toLowerCase()}`]
        : null,
      correct_option: question.correct_option,
      correct_option_text: question[`option_${question.correct_option.toLowerCase()}`],
      feedback_text: feedbackText,
      explanation: feedbackText,
    });
  } catch (err) {
    next(err);
  }
}

async function finishQuizAttempt(req, res, next) {
  try {
    const { attemptId } = req.params;
    const { abandoned } = req.body || {};

    const { data: attempt, error: attErr } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (attErr || !attempt) {
      return res.status(404).json({ error: 'Tentativa não encontrada.' });
    }

    if (attempt.status !== 'in_progress') {
      return res.json(attempt);
    }

    const { data: allAnswers } = await supabaseAdmin
      .from('quiz_answers')
      .select('is_correct, is_unanswered')
      .eq('attempt_id', attemptId);

    const answeredCount = (allAnswers || []).length;
    const correctCount = (allAnswers || []).filter((a) => a.is_correct).length;
    const incorrectCount = (allAnswers || []).filter((a) => !a.is_correct && !a.is_unanswered).length;
    const explicitUnanswered = (allAnswers || []).filter((a) => a.is_unanswered).length;
    const remainingUnanswered = Math.max(0, attempt.total_questions - answeredCount);
    const totalUnanswered = explicitUnanswered + remainingUnanswered;

    const accuracy = attempt.total_questions > 0
      ? Number(((correctCount / attempt.total_questions) * 100).toFixed(2))
      : 0;

    const finalStatus = abandoned ? 'abandoned' : 'completed';

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('quiz_attempts')
      .update({
        completed_at: new Date().toISOString(),
        correct_answers: correctCount,
        incorrect_answers: incorrectCount,
        unanswered_questions: totalUnanswered,
        accuracy_percentage: accuracy,
        status: finalStatus,
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (updErr) throw updErr;
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startQuizAttempt,
  submitQuestionAnswer,
  finishQuizAttempt,
};
