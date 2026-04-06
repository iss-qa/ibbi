const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const mongoose = require('mongoose');

// Carga das variáveis de ambiente
dotenv.config();

const connectDb = require('../backend/src/config/db');
const authRoutes = require('../backend/src/routes/auth.routes');
const personRoutes = require('../backend/src/routes/person.routes');
const userRoutes = require('../backend/src/routes/user.routes');
const messageRoutes = require('../backend/src/routes/message.routes');
const prayerRoutes = require('../backend/src/routes/prayer.routes');
const invitationRoutes = require('../backend/src/routes/invitation.routes');
const publicRoutes = require('../backend/src/routes/public.routes');
const dashboardRoutes = require('../backend/src/routes/dashboard.routes');
const uploadRoutes = require('../backend/src/routes/upload.routes');
const exportRoutes = require('../backend/src/routes/export.routes');
const ebdRoutes = require('../backend/src/routes/ebd.routes');
const testRoutes = require('../backend/src/routes/test.routes');
const statsRoutes = require('../backend/src/routes/stats.routes');
const imageRoutes = require('../backend/src/routes/image.routes');
const triagemRoutes = require('../backend/src/routes/triagem.routes');
const projetoAmigoRoutes = require('../backend/src/routes/projeto-amigo.routes');
const registrationRoutes = require('../backend/src/routes/registration.routes');

const app = express();

// Segurança
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      /\.vercel\.app$/,
      /wastezero\.com\.br$/,
      /issqa\.com\.br$/,
    ];
    const isAllowed = allowedOrigins.some(regex => regex.test(origin));
    if (isAllowed) return callback(null, true);
    return callback(new Error('CORS não permitido para esta origem'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Rate Limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Conexão com MongoDB via Middleware (garante que está conectado antes de cada rota)
app.use(async (req, res, next) => {
  // 1 = connected, 2 = connecting
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return next();
  }
  try {
    console.log('[DB] Conectando ao MongoDB...');
    await connectDb();
    console.log('[DB] MongoDB Conectado com sucesso.');
    next();
  } catch (err) {
    console.error('[DB] Erro de conexão:', err.message);
    res.status(500).json({ message: 'Erro de conexão com banco de dados' });
  }
});

// Rotas
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: 'serverless',
    dbState: mongoose.connection.readyState 
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/prayer', prayerRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/ebd', ebdRoutes);
app.use('/api/test', testRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/triagem-grupos', triagemRoutes);
app.use('/api/grupos', triagemRoutes);
app.use('/api/projeto-amigo', projetoAmigoRoutes);
app.use('/api/registrations', registrationRoutes);

// Error Handling
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', {
    message: err.message,
    path: req.path,
    method: req.method,
  });
  res.status(err.status || 500).json({ message: err.message || 'Erro interno' });
});

module.exports = app;
