const { supabaseAdmin } = require('../config/supabase');
const { uploadSubjectImage } = require('../services/storageService');

async function listPublicSubjects(req, res, next) {
  try {
    const { data: subjects, error } = await supabaseAdmin
      .from('subjects')
      .select(`
        id,
        name,
        description,
        image_url,
        questions!inner(id, is_active)
      `)
      .eq('is_active', true)
      .eq('questions.is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    const formatted = (subjects || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      image_url: s.image_url,
      question_count: Array.isArray(s.questions) ? s.questions.length : 0,
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

async function listAdminSubjects(req, res, next) {
  try {
    const { data: subjects, error } = await supabaseAdmin
      .from('subjects')
      .select(`
        *,
        questions(id, is_active),
        quiz_attempts(id)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (subjects || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      image_url: s.image_url,
      is_active: s.is_active,
      created_at: s.created_at,
      updated_at: s.updated_at,
      total_questions: s.questions ? s.questions.length : 0,
      active_questions: s.questions ? s.questions.filter((q) => q.is_active).length : 0,
      total_attempts: s.quiz_attempts ? s.quiz_attempts.length : 0,
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

async function createSubject(req, res, next) {
  try {
    const { name, description, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome do tema é obrigatório.' });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadSubjectImage(req.file);
    }

    const { data, error } = await supabaseAdmin
      .from('subjects')
      .insert({
        name: name.trim(),
        description: description ? description.trim() : null,
        image_url: imageUrl,
        is_active: is_active === 'false' || is_active === false ? false : true,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function updateSubject(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, is_active, remove_image } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome do tema é obrigatório.' });
    }

    const updates = {
      name: name.trim(),
      description: description ? description.trim() : null,
      is_active: is_active === 'false' || is_active === false ? false : true,
    };

    if (req.file) {
      updates.image_url = await uploadSubjectImage(req.file);
    } else if (remove_image === 'true' || remove_image === true) {
      updates.image_url = null;
    }

    const { data, error } = await supabaseAdmin
      .from('subjects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function toggleSubjectStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const { data, error } = await supabaseAdmin
      .from('subjects')
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

async function deleteSubject(req, res, next) {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Tema excluído com sucesso. O histórico de tentativas foi preservado.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublicSubjects,
  listAdminSubjects,
  createSubject,
  updateSubject,
  toggleSubjectStatus,
  deleteSubject,
};
