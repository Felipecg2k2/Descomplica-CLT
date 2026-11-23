function errorHandler(err, req, res, next) {
  console.error('[API Error]', err);

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Erro no envio de arquivo: ${err.message}` });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno no servidor.';

  res.status(statusCode).json({ error: message });
}

module.exports = { errorHandler };
