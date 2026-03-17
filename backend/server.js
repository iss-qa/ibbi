const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

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
const { startScheduler } = require('./src/services/scheduler.service');

dotenv.config({ path: require('path').join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    return callback(null, allowed);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/uploads', express.static(require('path').join(__dirname, '..', 'uploads')));

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Erro interno' });
});

connectDb()
  .then(() => {
    startScheduler();
    app.listen(PORT, () => {
      console.log(`Backend rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erro ao conectar no MongoDB:', err);
    process.exit(1);
  });
