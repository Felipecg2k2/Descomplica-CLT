const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');
const path = require('path');

async function uploadSubjectImage(file) {
  if (!file) return null;

  const ext = path.extname(file.originalname) || '.png';
  const fileName = `subject_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(env.storageBucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Falha ao enviar imagem para o Storage: ${uploadError.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(env.storageBucket)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

module.exports = { uploadSubjectImage };
