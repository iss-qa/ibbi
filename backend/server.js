const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDb = require('./src/config/db');
const authRoutes = require('./src/routes/auth.routes');
const personRoutes = require('./src/routes/person.routes');
const userRoutes = require('./src/routes/user.routes');
const messageRoutes = require('./src/routes/message.routes');
const prayerRoutes = require('./src/routes/prayer.routes');
const invitationRoutes = require('./src/routes/invitation.routes');
const publicRoutes = require('./src/routes/public.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const exportRoutes = require('./src/routes/export.routes');
const ebdRoutes = require('./src/routes/ebd.routes');
const testRoutes = require('./src/routes/test.routes');
const statsRoutes = require('./src/routes/stats.routes');
const imageRoutes = require('./src/routes/image.routes');
const { startScheduler } = require('./src/services/scheduler.service');
const { startEvolutionMonitor } = require('./src/services/evolution-monitor.service');
const tenantRoutes = require('./src/routes/tenant.routes');
const careRoutes = require('./src/routes/care.routes');
const assistantRoutes = require('./src/routes/assistant.routes');
const webhookRoutes = require('./src/routes/webhook.routes');
const platformRoutes = require('./src/routes/platform.routes');
const meRoutes = require('./src/routes/me.routes');
const whatsappPanelRoutes = require('./src/routes/whatsapp-panel.routes');
const encontroRoutes = require('./src/routes/encontro.routes');
const { bootstrapTenancy } = require('./src/tenancy/bootstrap');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Validar variáveis de ambiente obrigatórias
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[STARTUP] Variáveis de ambiente obrigatórias não configuradas: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  contentSecurityPolicy: false, // CSP desativado para não quebrar frontend SPA
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      /\.vercel\.app$/,
      /wastezero\.com\.br$/,
      /issqa\.com\.br$/,
      ...(process.env.APP_BASE_DOMAIN ? [new RegExp(`${process.env.APP_BASE_DOMAIN.replace(/\./g, '\\.')}$`)] : []),
      ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
    ];

    const isAllowed = allowedOrigins.some((rule) => (typeof rule === 'string' ? rule === origin : rule.test(origin)));
    
    if (isAllowed || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    return callback(new Error('CORS não permitido para esta origem: ' + origin));
  },
  credentials: true,
}));
// rawBody: validação da assinatura dos webhooks da Meta (X-Hub-Signature-256)
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhooks/')) req.rawBody = buf;
  },
}));

// A igreja vem sempre do contexto (JWT/slug), nunca do corpo: evita mass assignment de tenantId.
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) delete req.body.tenantId;
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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
app.use('/api/tenant', tenantRoutes);
app.use('/api/care', careRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/me', meRoutes);
app.use('/api/whatsapp-panel', whatsappPanelRoutes);
app.use('/api/encontros', encontroRoutes);

const triagemRoutes = require('./src/routes/triagem.routes');
const projetoAmigoRoutes = require('./src/routes/projeto-amigo.routes');
const registrationRoutes = require('./src/routes/registration.routes');
app.use('/api/triagem-grupos', triagemRoutes);
app.use('/api/grupos', triagemRoutes);
app.use('/api/projeto-amigo', projetoAmigoRoutes);
app.use('/api/registrations', registrationRoutes);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });
  res.status(err.status || 500).json({
    message: err.message || 'Erro interno no servidor',
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

connectDb()
  .then(bootstrapTenancy)
  .then(() => {
    startScheduler();
    startEvolutionMonitor();
    app.listen(PORT, () => {
      console.log(`Backend rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erro ao conectar no MongoDB:', err);
    process.exit(1);
  });
