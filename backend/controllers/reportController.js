const { supabaseAdmin } = require('../config/supabase');
const xlsx = require('xlsx');

async function getDashboardSummary(req, res, next) {
  try {
    const [
      { count: totalSubjects },
      { count: totalQuestions },
      { data: attempts },
      { data: answers },
    ] = await Promise.all([
      supabaseAdmin.from('subjects').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('quiz_attempts').select('*').order('started_at', { ascending: false }),
      supabaseAdmin.from('quiz_answers').select('question_id, statement_snapshot, is_correct, is_unanswered'),
    ]);

    const allAttempts = attempts || [];
    const completedAttempts = allAttempts.filter((a) => a.status === 'completed');
    const uniqueStudents = new Set(allAttempts.map((a) => a.student_name.trim().toLowerCase())).size;

    const avgAccuracy = completedAttempts.length > 0
      ? Number(
          (
            completedAttempts.reduce((acc, cur) => acc + Number(cur.accuracy_percentage || 0), 0) /
            completedAttempts.length
          ).toFixed(1)
        )
      : 0;

    const subjectMap = {};
    allAttempts.forEach((a) => {
      const name = a.subject_name_snapshot || 'Tema removido';
      if (!subjectMap[name]) subjectMap[name] = { name, count: 0, sumAcc: 0 };
      subjectMap[name].count += 1;
      subjectMap[name].sumAcc += Number(a.accuracy_percentage || 0);
    });
    const topSubjects = Object.values(subjectMap)
      .map((s) => ({
        name: s.name,
        attempts: s.count,
        avg_accuracy: Number((s.sumAcc / s.count).toFixed(1)),
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 5);

    const questionMap = {};
    (answers || []).forEach((ans) => {
      const key = ans.question_id || ans.statement_snapshot;
      if (!questionMap[key]) {
        questionMap[key] = {
          statement: ans.statement_snapshot,
          total: 0,
          errors: 0,
          corrects: 0,
        };
      }
      questionMap[key].total += 1;
      if (ans.is_correct) questionMap[key].corrects += 1;
      else if (!ans.is_unanswered) questionMap[key].errors += 1;
    });

    const mostMissedQuestions = Object.values(questionMap)
      .filter((q) => q.total > 0)
      .map((q) => ({
        ...q,
        error_rate: Number(((q.errors / q.total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.errors - a.errors || b.error_rate - a.error_rate)
      .slice(0, 5);

    res.json({
      metrics: {
        total_subjects: totalSubjects || 0,
        total_questions: totalQuestions || 0,
        unique_students: uniqueStudents,
        total_attempts: allAttempts.length,
        average_accuracy: avgAccuracy,
      },
      recent_attempts: allAttempts.slice(0, 8),
      top_subjects: topSubjects,
      most_missed_questions: mostMissedQuestions,
    });
  } catch (err) {
    next(err);
  }
}

async function getAttemptsReport(req, res, next) {
  try {
    const { student_name, subject_id, date_from, date_to, status } = req.query;

    let query = supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .order('started_at', { ascending: false });

    if (student_name && student_name.trim()) {
      query = query.ilike('student_name', `%${student_name.trim()}%`);
    }
    if (subject_id) {
      query = query.eq('subject_id', subject_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (date_from) {
      query = query.gte('started_at', `${date_from}T00:00:00.000Z`);
    }
    if (date_to) {
      query = query.lte('started_at', `${date_to}T23:59:59.999Z`);
    }

    const { data: attempts, error } = await query;
    if (error) throw error;

    const list = attempts || [];

    const total = list.length;
    const avgAccuracy = total > 0
      ? Number((list.reduce((s, a) => s + Number(a.accuracy_percentage || 0), 0) / total).toFixed(1))
      : 0;

    let questionStats = [];
    if (list.length > 0) {
      const attemptIds = list.map((a) => a.id);
      const { data: answers } = await supabaseAdmin
        .from('quiz_answers')
        .select('question_id, statement_snapshot, is_correct, is_unanswered, response_time_seconds')
        .in('attempt_id', attemptIds);

      const qMap = {};
      (answers || []).forEach((ans) => {
        const key = ans.question_id || ans.statement_snapshot;
        if (!qMap[key]) {
          qMap[key] = {
            statement: ans.statement_snapshot,
            total: 0,
            corrects: 0,
            errors: 0,
            unanswered: 0,
            timeSum: 0,
            timeCount: 0,
          };
        }
        qMap[key].total += 1;
        if (ans.is_correct) qMap[key].corrects += 1;
        else if (ans.is_unanswered) qMap[key].unanswered += 1;
        else qMap[key].errors += 1;

        if (typeof ans.response_time_seconds === 'number') {
          qMap[key].timeSum += ans.response_time_seconds;
          qMap[key].timeCount += 1;
        }
      });

      questionStats = Object.values(qMap).map((q) => ({
        statement: q.statement,
        total: q.total,
        corrects: q.corrects,
        errors: q.errors,
        unanswered: q.unanswered,
        accuracy_rate: q.total > 0 ? Number(((q.corrects / q.total) * 100).toFixed(1)) : 0,
        avg_time_seconds: q.timeCount > 0 ? Math.round(q.timeSum / q.timeCount) : null,
      }));
    }

    res.json({
      summary: {
        total_attempts: total,
        average_accuracy: avgAccuracy,
      },
      attempts: list,
      question_stats: questionStats,
    });
  } catch (err) {
    next(err);
  }
}

async function getAttemptDetails(req, res, next) {
  try {
    const { id } = req.params;
    const { data: attempt, error: attErr } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .eq('id', id)
      .single();

    if (attErr || !attempt) {
      return res.status(404).json({ error: 'Tentativa não encontrada.' });
    }

    const { data: answers, error: ansErr } = await supabaseAdmin
      .from('quiz_answers')
      .select('*')
      .eq('attempt_id', id)
      .order('created_at', { ascending: true });

    if (ansErr) throw ansErr;

    res.json({ attempt, answers: answers || [] });
  } catch (err) {
    next(err);
  }
}

async function exportReports(req, res, next) {
  try {
    const { format = 'xlsx', student_name, subject_id, date_from, date_to } = req.query;

    let query = supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .order('started_at', { ascending: false });

    if (student_name && student_name.trim()) {
      query = query.ilike('student_name', `%${student_name.trim()}%`);
    }
    if (subject_id) query = query.eq('subject_id', subject_id);
    if (date_from) query = query.gte('started_at', `${date_from}T00:00:00.000Z`);
    if (date_to) query = query.lte('started_at', `${date_to}T23:59:59.999Z`);

    const { data: attempts, error } = await query;
    if (error) throw error;

    const statusLabels = {
      completed: 'Concluída',
      in_progress: 'Em andamento',
      abandoned: 'Interrompida / Inatividade',
    };

    const rows = (attempts || []).map((a) => ({
      'ID Tentativa': a.id,
      'Nome do Aluno': a.student_name,
      'Tema': a.subject_name_snapshot,
      'Início': new Date(a.started_at).toLocaleString('pt-BR'),
      'Conclusão': a.completed_at ? new Date(a.completed_at).toLocaleString('pt-BR') : '-',
      'Total Questões': a.total_questions,
      'Acertos': a.correct_answers,
      'Erros': a.incorrect_answers,
      'Não Respondidas': a.unanswered_questions,
      'Aproveitamento (%)': Number(a.accuracy_percentage),
      'Situação': statusLabels[a.status] || a.status,
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Resultados_Descomplica_CLT');

    if (format === 'csv') {
      const csvOutput = xlsx.utils.sheet_to_csv(worksheet, { FS: ';' });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-descomplica-clt.csv"');
      return res.send('﻿' + csvOutput);
    }

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-descomplica-clt.xlsx"');
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardSummary,
  getAttemptsReport,
  getAttemptDetails,
  exportReports,
};
