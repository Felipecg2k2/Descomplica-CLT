const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');

const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Descomplica CLT', timestamp: new Date().toISOString() });
});

app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'aluno', 'index.html'));
});

app.get('/aluno', (req, res) => {
  res.sendFile(path.join(frontendPath, 'aluno', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin', 'login.html'));
});

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`====================================================`);
  console.log(` Descomplica CLT ativo na porta ${env.port}`);
  console.log(` Totem Aluno: http://localhost:${env.port}/aluno`);
  console.log(` Painel Admin: http://localhost:${env.port}/admin`);
  console.log(`====================================================`);
});
