const { supabaseAdmin } = require('../config/supabase');
const xlsx = require('xlsx');
const {
  normalizeText,
  calculateStatementSimilarity,
  generateQuestionsTemplateDocx,
  parseQuestionsFromDocxBuffer,
} = require('../services/docxService');

async function listQuestions(req, res, next) {
  try {
    const { subject_id } = req.query;
    let query = supabaseAdmin
      .from('questions')
      .select('*, subjects(name)')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (subject_id) {
      query = query.eq('subject_id', subject_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const normalized = (data || []).map((q) => {
      const mode = q.feedback_mode === 'individual' ? 'individual' : 'general';
      const fbCorrect = q.feedback_correct || q.explanation || '';
      const fbIncorrect = q.feedback_incorrect || q.explanation || '';
      const needsReview =
        !fbCorrect ||
        (mode === 'general' && !fbIncorrect) ||
        (mode === 'individual' &&
          ['A', 'B', 'C', 'D'].some(
            (opt) => opt !== q.correct_option && !q[`feedback_incorrect_${opt.toLowerCase()}`]
          ));

      return {
        ...q,
        feedback_mode: mode,
        feedback_correct: fbCorrect,
        feedback_incorrect: fbIncorrect,
        feedback_incorrect_a: q.feedback_incorrect_a || '',
        feedback_incorrect_b: q.feedback_incorrect_b || '',
        feedback_incorrect_c: q.feedback_incorrect_c || '',
        feedback_incorrect_d: q.feedback_incorrect_d || '',
        needs_feedback_review: needsReview,
      };
    });

    res.json(normalized);
  } catch (err) {
    next(err);
  }
}

function validateQuestionPayload(body) {
  const {
    subject_id,
    statement,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    feedback_correct,
    feedback_mode,
    feedback_incorrect,
    feedback_incorrect_a,
    feedback_incorrect_b,
    feedback_incorrect_c,
    feedback_incorrect_d,
    explanation,
  } = body;

  if (!subject_id) return 'Selecione o tema relacionado.';
  if (!statement || !statement.trim()) return 'O enunciado da pergunta é obrigatório.';
  if (!option_a || !option_a.trim()) return 'A alternativa A é obrigatória.';
  if (!option_b || !option_b.trim()) return 'A alternativa B é obrigatória.';
  if (!option_c || !option_c.trim()) return 'A alternativa C é obrigatória.';
  if (!option_d || !option_d.trim()) return 'A alternativa D é obrigatória.';

  const normalizedCorrect = String(correct_option || '').trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(normalizedCorrect)) {
    return 'A alternativa correta deve ser A, B, C ou D.';
  }

  const fbCorrect = (feedback_correct || explanation || '').trim();
  if (!fbCorrect) {
    return 'O feedback para resposta correta é obrigatório.';
  }

  const mode = feedback_mode === 'individual' ? 'individual' : 'general';

  if (mode === 'individual') {
    const indMap = {
      A: (feedback_incorrect_a || '').trim(),
      B: (feedback_incorrect_b || '').trim(),
      C: (feedback_incorrect_c || '').trim(),
      D: (feedback_incorrect_d || '').trim(),
    };
    for (const opt of ['A', 'B', 'C', 'D']) {
      if (opt !== normalizedCorrect && !indMap[opt]) {
        return `O feedback individual para a alternativa incorreta ${opt} é obrigatório.`;
      }
    }
  } else {
    const fbIncorrect = (feedback_incorrect || explanation || '').trim();
    if (!fbIncorrect) {
      return 'O feedback geral para resposta incorreta é obrigatório.';
    }
  }

  return null;
}

function buildQuestionPersistenceFields(body) {
  const normalizedCorrect = body.correct_option.trim().toUpperCase();
  const mode = body.feedback_mode === 'individual' ? 'individual' : 'general';
  const fbCorrectTrim = body.feedback_correct.trim();
  const fbIncorrectTrim = body.feedback_incorrect ? body.feedback_incorrect.trim() : null;

  return {
    statement: body.statement.trim(),
    option_a: body.option_a.trim(),
    option_b: body.option_b.trim(),
    option_c: body.option_c.trim(),
    option_d: body.option_d.trim(),
    correct_option: normalizedCorrect,
    feedback_correct: fbCorrectTrim,
    feedback_mode: mode,
    feedback_incorrect: mode === 'general' ? fbIncorrectTrim : (fbIncorrectTrim || null),
    feedback_incorrect_a:
      mode === 'individual' && normalizedCorrect !== 'A' && body.feedback_incorrect_a
        ? body.feedback_incorrect_a.trim()
        : null,
    feedback_incorrect_b:
      mode === 'individual' && normalizedCorrect !== 'B' && body.feedback_incorrect_b
        ? body.feedback_incorrect_b.trim()
        : null,
    feedback_incorrect_c:
      mode === 'individual' && normalizedCorrect !== 'C' && body.feedback_incorrect_c
        ? body.feedback_incorrect_c.trim()
        : null,
    feedback_incorrect_d:
      mode === 'individual' && normalizedCorrect !== 'D' && body.feedback_incorrect_d
        ? body.feedback_incorrect_d.trim()
        : null,
    explanation: fbCorrectTrim,
  };
}

async function createQuestion(req, res, next) {
  try {
    const validationError = validateQuestionPayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { subject_id, is_active } = req.body;

    const { data: lastQuestion } = await supabaseAdmin
      .from('questions')
      .select('display_order')
      .eq('subject_id', subject_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = lastQuestion ? lastQuestion.display_order + 1 : 1;
    const fields = buildQuestionPersistenceFields(req.body);

    const { data, error } = await supabaseAdmin
      .from('questions')
      .insert({
        subject_id,
        ...fields,
        display_order: nextOrder,
        is_active: is_active === false ? false : true,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function updateQuestion(req, res, next) {
  try {
    const { id } = req.params;
    const validationError = validateQuestionPayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { subject_id, is_active } = req.body;
    const fields = buildQuestionPersistenceFields(req.body);

    const { data, error } = await supabaseAdmin
      .from('questions')
      .update({
        subject_id,
        ...fields,
        is_active: Boolean(is_active),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function duplicateQuestion(req, res, next) {
  try {
    const { id } = req.params;
    const { data: original, error: fetchErr } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !original) {
      return res.status(404).json({ error: 'Pergunta original não encontrada.' });
    }

    const { data: lastQuestion } = await supabaseAdmin
      .from('questions')
      .select('display_order')
      .eq('subject_id', original.subject_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = lastQuestion ? lastQuestion.display_order + 1 : 1;
    const fbCorr = original.feedback_correct || original.explanation || '';
    const fbInc = original.feedback_incorrect || original.explanation || '';

    const { data: copy, error: insertErr } = await supabaseAdmin
      .from('questions')
      .insert({
        subject_id: original.subject_id,
        statement: `${original.statement} (Cópia)`,
        option_a: original.option_a,
        option_b: original.option_b,
        option_c: original.option_c,
        option_d: original.option_d,
        correct_option: original.correct_option,
        feedback_correct: fbCorr,
        feedback_mode: original.feedback_mode || 'general',
        feedback_incorrect: fbInc,
        feedback_incorrect_a: original.feedback_incorrect_a || null,
        feedback_incorrect_b: original.feedback_incorrect_b || null,
        feedback_incorrect_c: original.feedback_incorrect_c || null,
        feedback_incorrect_d: original.feedback_incorrect_d || null,
        explanation: fbCorr,
        display_order: nextOrder,
        is_active: original.is_active,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    res.status(201).json(copy);
  } catch (err) {
    next(err);
  }
}

async function toggleQuestionStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const { data, error } = await supabaseAdmin
      .from('questions')
      .update({ is_active: Boolean(is_active) })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function reorderQuestions(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Lista de ordenação inválida.' });
    }

    for (const item of items) {
      const { error } = await supabaseAdmin
        .from('questions')
        .update({ display_order: parseInt(item.display_order, 10) })
        .eq('id', item.id);
      if (error) throw error;
    }

    res.json({ message: 'Ordem das perguntas atualizada com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function deleteQuestion(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Pergunta excluída com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function downloadDocxTemplate(req, res, next) {
  try {
    const buffer = await generateQuestionsTemplateDocx();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="modelo-questoes-descomplica-clt.docx"'
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function previewDocxImport(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecione um arquivo Word (.docx).' });
    }

    const parsed = await parseQuestionsFromDocxBuffer(req.file.buffer);
    const { override_subject_id } = req.body || {};

    const { data: allSubjects, error: subjErr } = await supabaseAdmin
      .from('subjects')
      .select('id, name, description, is_active');

    if (subjErr) throw subjErr;

    let matchedSubject = null;

    if (override_subject_id) {
      matchedSubject = (allSubjects || []).find((s) => s.id === override_subject_id) || null;
    } else if (parsed.theme_name) {
      const targetNorm = normalizeText(parsed.theme_name);
      matchedSubject =
        (allSubjects || []).find((s) => normalizeText(s.name) === targetNorm) || null;
    }

    const themeValid = Boolean(matchedSubject || (parsed.theme_name && parsed.theme_name.trim().length > 0));

    let existingQuestions = [];
    if (matchedSubject) {
      const { data: qData, error: qErr } = await supabaseAdmin
        .from('questions')
        .select('id, statement')
        .eq('subject_id', matchedSubject.id);
      if (qErr) throw qErr;
      existingQuestions = qData || [];
    }

    const analyzedQuestions = parsed.questions.map((q) => {
      if (!q.is_valid) {
        return {
          ...q,
          match_status: 'invalid',
          matched_question_id: null,
          matched_statement: null,
          similarity: 0,
        };
      }

      if (!matchedSubject || existingQuestions.length === 0) {
        return {
          ...q,
          match_status: 'new',
          matched_question_id: null,
          matched_statement: null,
          similarity: 0,
        };
      }

      if (q.explicit_id) {
        const byId = existingQuestions.find((eq) => eq.id === q.explicit_id);
        if (byId) {
          return {
            ...q,
            match_status: 'exact_match',
            matched_question_id: byId.id,
            matched_statement: byId.statement,
            similarity: 1,
          };
        }
      }

      const qNorm = normalizeText(q.statement);
      const exactByText = existingQuestions.find((eq) => normalizeText(eq.statement) === qNorm);
      if (exactByText) {
        return {
          ...q,
          match_status: 'exact_match',
          matched_question_id: exactByText.id,
          matched_statement: exactByText.statement,
          similarity: 1,
        };
      }

      let bestCandidate = null;
      let bestScore = 0;
      for (const eq of existingQuestions) {
        const score = calculateStatementSimilarity(q.statement, eq.statement);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = eq;
        }
      }

      if (bestCandidate && bestScore >= 0.65) {
        return {
          ...q,
          match_status: 'ambiguous',
          matched_question_id: bestCandidate.id,
          matched_statement: bestCandidate.statement,
          similarity: Number((bestScore * 100).toFixed(0)),
        };
      }

      return {
        ...q,
        match_status: 'new',
        matched_question_id: null,
        matched_statement: null,
        similarity: 0,
      };
    });

    const summary = {
      total_found: analyzedQuestions.length,
      new_count: analyzedQuestions.filter((q) => q.match_status === 'new').length,
      exact_match_count: analyzedQuestions.filter((q) => q.match_status === 'exact_match').length,
      ambiguous_count: analyzedQuestions.filter((q) => q.match_status === 'ambiguous').length,
      invalid_count: analyzedQuestions.filter((q) => q.match_status === 'invalid').length,
    };

    res.json({
      theme: {
        detected_name: parsed.theme_name,
        detected_description: parsed.theme_description,
        is_valid: themeValid,
        status: matchedSubject ? 'existing' : 'new',
        existing_subject: matchedSubject,
      },
      summary,
      questions: analyzedQuestions,
    });
  } catch (err) {
    next(err);
  }
}

async function confirmDocxImport(req, res, next) {
  let createdSubjectId = null;
  const insertedQuestionIds = [];

  try {
    const {
      theme_name,
      theme_description,
      existing_subject_id,
      questions,
    } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma questão selecionada para importação.' });
    }

    let targetSubjectId = existing_subject_id || null;

    if (!targetSubjectId) {
      if (!theme_name || !theme_name.trim()) {
        return res.status(400).json({ error: 'Nome do tema não identificado no documento.' });
      }

      const { data: allSubjects } = await supabaseAdmin
        .from('subjects')
        .select('id, name');

      const normTarget = normalizeText(theme_name);
      const existing = (allSubjects || []).find((s) => normalizeText(s.name) === normTarget);

      if (existing) {
        targetSubjectId = existing.id;
      } else {
        const { data: newSubj, error: createSubjErr } = await supabaseAdmin
          .from('subjects')
          .insert({
            name: theme_name.trim(),
            description: theme_description ? theme_description.trim() : null,
            is_active: true,
          })
          .select()
          .single();

        if (createSubjErr) throw createSubjErr;
        targetSubjectId = newSubj.id;
        createdSubjectId = newSubj.id;
      }
    }

    const { data: lastQ } = await supabaseAdmin
      .from('questions')
      .select('display_order')
      .eq('subject_id', targetSubjectId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextOrder = lastQ ? lastQ.display_order : 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (const item of questions) {
      if (item.action === 'skip') continue;

      const validationError = validateQuestionPayload({
        ...item,
        subject_id: targetSubjectId,
      });
      if (validationError) {
        throw new Error(`Questão #${item.question_number}: ${validationError}`);
      }

      const fields = buildQuestionPersistenceFields(item);

      if (item.action === 'update' && item.target_question_id) {
        const { error: updErr } = await supabaseAdmin
          .from('questions')
          .update(fields)
          .eq('id', item.target_question_id)
          .eq('subject_id', targetSubjectId);

        if (updErr) throw updErr;
        updatedCount += 1;
      } else {
        nextOrder += 1;
        const { data: insData, error: insErr } = await supabaseAdmin
          .from('questions')
          .insert({
            subject_id: targetSubjectId,
            ...fields,
            display_order: nextOrder,
            is_active: true,
          })
          .select('id')
          .single();

        if (insErr) throw insErr;
        insertedQuestionIds.push(insData.id);
        createdCount += 1;
      }
    }

    res.status(201).json({
      subject_id: targetSubjectId,
      theme_created: Boolean(createdSubjectId),
      created_count: createdCount,
      updated_count: updatedCount,
    });
  } catch (err) {
    if (insertedQuestionIds.length > 0) {
      await supabaseAdmin.from('questions').delete().in('id', insertedQuestionIds);
    }
    if (createdSubjectId) {
      await supabaseAdmin.from('subjects').delete().eq('id', createdSubjectId);
    }
    next(err);
  }
}

async function previewImportQuestions(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(firstSheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'A planilha está vazia.' });
    }

    const parsed = rows.map((row, index) => {
      const statement = String(row.enunciado || row.Enunciado || row.statement || '').trim();
      const option_a = String(row.alternativa_a || row.A || row.a || row.option_a || '').trim();
      const option_b = String(row.alternativa_b || row.B || row.b || row.option_b || '').trim();
      const option_c = String(row.alternativa_c || row.C || row.c || row.option_c || '').trim();
      const option_d = String(row.alternativa_d || row.D || row.d || row.option_d || '').trim();
      const correct_option = String(row.correta || row.Correta || row.resposta_correta || row.correct_option || '').trim().toUpperCase();
      const legacyExp = String(row.explicacao || row.Explicacao || row.feedback || '').trim();
      const feedback_correct = String(row.feedback_acerto || row.feedback_correta || legacyExp).trim();
      const feedback_incorrect = String(row.feedback_erro || row.feedback_incorreta || legacyExp).trim();

      const errors = [];
      if (!statement) errors.push('Enunciado ausente');
      if (!option_a || !option_b || !option_c || !option_d) errors.push('Alternativa(s) A-D incompleta(s)');
      if (!['A', 'B', 'C', 'D'].includes(correct_option)) errors.push('Resposta correta deve ser A, B, C ou D');
      if (!feedback_correct) errors.push('Feedback de acerto ausente');
      if (!feedback_incorrect) errors.push('Feedback de erro ausente');

      return {
        row_number: index + 2,
        statement,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        feedback_correct,
        feedback_mode: 'general',
        feedback_incorrect,
        is_valid: errors.length === 0,
        errors,
      };
    });

    res.json({
      total_rows: parsed.length,
      valid_count: parsed.filter((r) => r.is_valid).length,
      invalid_count: parsed.filter((r) => !r.is_valid).length,
      items: parsed,
    });
  } catch (err) {
    next(err);
  }
}

async function confirmImportQuestions(req, res, next) {
  try {
    const { subject_id, questions } = req.body;
    if (!subject_id) {
      return res.status(400).json({ error: 'Selecione o tema de destino.' });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma questão válida para importar.' });
    }

    const { data: lastQuestion } = await supabaseAdmin
      .from('questions')
      .select('display_order')
      .eq('subject_id', subject_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let currentOrder = lastQuestion ? lastQuestion.display_order : 0;

    const toInsert = [];
    for (const q of questions) {
      const err = validateQuestionPayload({ ...q, subject_id });
      if (err) {
        return res.status(400).json({ error: `Erro de validação na questão "${q.statement?.slice(0, 30)}...": ${err}` });
      }
      currentOrder += 1;
      const fields = buildQuestionPersistenceFields(q);
      toInsert.push({
        subject_id,
        ...fields,
        display_order: currentOrder,
        is_active: true,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('questions')
      .insert(toInsert)
      .select();

    if (error) throw error;
    res.status(201).json({
      imported_count: data.length,
      questions: data,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};
