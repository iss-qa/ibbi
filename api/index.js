const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const path = require('path');

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

dotenv.config();

const app = express();

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', environment: 'serverless' }));

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

// Database connection helper for serverless
let cachedDb = null;

const handler = async (req, res) => {
  if (!cachedDb) {
    cachedDb = await connectDb();
  }
  return app(req, res);
};

module.exports = handler;
