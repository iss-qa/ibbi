const express = require('express');
const { httpStatusFor } = require('./src/utils/async-errors');
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
const servicoRoutes = require('./src/routes/servico.routes');
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

const IS_PROD = process.env.NODE_ENV === 'production';
const WEAK_JWT_SECRETS = ['ibbi_secret_key_2026', 'troque-por-32-caracteres-aleatorios', 'change-me', 'secret'];
if (IS_PROD && (process.env.JWT_SECRET.length < 32 || WEAK_JWT_SECRETS.includes(process.env.JWT_SECRET))) {
  // Alerta (não derruba o boot para não tirar a produção do ar num deploy): troque o segredo.
  console.error('[STARTUP][SEGURANÇA] JWT_SECRET fraco: use ao menos 32 caracteres aleatórios em produção.');
}

// Rede de segurança: promise sem await (disparos em background) não derruba a plataforma.
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason?.stack || reason);
});

const app = express();
// Atrás do proxy (EasyPanel): IP real do cliente para o rate limit.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
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
      // Ancorado: /wastezero\.com\.br$/ aceitava evilwastezero.com.br
      /^https:\/\/([a-z0-9-]+\.)*wastezero\.com\.br$/,
      /^https:\/\/([a-z0-9-]+\.)*issqa\.com\.br$/,
      ...(process.env.APP_BASE_DOMAIN ? [new RegExp(`^https:\\/\\/([a-z0-9-]+\\.)*${process.env.APP_BASE_DOMAIN.replace(/\./g, '\\.')}$`)] : []),
      ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
    ];

    const isAllowed = allowedOrigins.some((rule) => (typeof rule === 'string' ? rule === origin : rule.test(origin)));
    
    if (isAllowed || !IS_PROD) {
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

app.use(require('./src/utils/sanitize').sanitizeQuery);

// A igreja vem sempre do contexto (JWT/slug), nunca do corpo: evita mass assignment de tenantId.
// Chaves "$…" no topo do corpo viram operadores do Mongo em updates que repassam o corpo
// (ex.: { "$min": { "tenantId": … } }): também são removidas.
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && !req.originalUrl.startsWith('/api/webhooks/')) {
    delete req.body.tenantId;
    Object.keys(req.body).forEach((k) => { if (k.startsWith('$')) delete req.body[k]; });
  }
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

// Limite só no login: /api/auth/me é chamado a cada carregamento e esgotava a cota de quem só navega
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);
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
// Envio de teste avulso: só fora de produção (não passa pela fila anti-ban nem gera log)
if (!IS_PROD) app.use('/api/test', testRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/care', careRoutes);
app.use('/api', servicoRoutes); // /api/cultos, /api/escalas, /api/jornadas
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

// Convite de check-in encaminhado nos grupos: prévia com o logo da igreja → wa.me
app.get('/c/:slug/:codigo', require('./src/controllers/checkin-share.controller').page);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => {
  const status = httpStatusFor(err);
  console.error('[SERVER ERROR]', {
    message: err.message,
    stack: status >= 500 ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });
  if (res.headersSent) return next(err);
  // 5xx: mensagem genérica (não expõe detalhes internos do Mongo/stack ao cliente)
  return res.status(status).json({
    message: status >= 500 ? 'Erro interno no servidor' : (err.message || 'Requisição inválida'),
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
  });
});

// Conexão + migração idempotente do multi-tenant, depois API, scheduler e monitor.
const init = () => connectDb().then(bootstrapTenancy);

init()
  .then(() => {
    // DISABLE_SCHEDULER=true: sobe só a API (QA/desenvolvimento), sem automações nem monitor.
    if (process.env.DISABLE_SCHEDULER === 'true') {
      console.log('[server] Scheduler e monitor da Evolution DESLIGADOS (DISABLE_SCHEDULER=true).');
    } else {
      startScheduler();
      startEvolutionMonitor();
    }
    app.listen(PORT, () => {
      console.log(`Backend rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erro ao conectar no MongoDB:', err);
    process.exit(1);
  });

module.exports = { app, init };
