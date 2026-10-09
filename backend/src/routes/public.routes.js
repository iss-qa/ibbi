const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/invitation.controller');
const signup = require('../controllers/signup.controller');
const { PLANS } = require('../config/plans');
const { getTenantBySlug, serializePublic } = require('../tenancy/tenant.service');

const router = express.Router();

// Catálogo de nomes do assistente (Configurações → IA)
router.get('/assistentes', (req, res) => {
  const { ASSISTENTES, ASSISTENTE_PADRAO, saudacaoAssistente } = require('../config/assistentes');
  res.json({
    padrao: ASSISTENTE_PADRAO,
    assistentes: Object.entries(ASSISTENTES).map(([nome, a]) => ({
      nome, genero: a.genero, significado: a.significado,
      exemplo: saudacaoAssistente({ nomeUsuario: 'Pastor', assistente: nome, igreja: 'sua igreja', produto: 'PastorIA' }),
    })),
  });
});

// Catálogo de planos (página pública de preços)
router.get('/plans', (req, res) => res.json(Object.values(PLANS)));

// Identidade visual da igreja para a tela de login (?igreja=slug)
router.get('/tenants/:slug', async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant || tenant.status === 'cancelada') return res.status(404).json({ message: 'Igreja não encontrada' });
  return res.json(serializePublic(tenant));
});

router.get('/invitations/:token/tenant', controller.invitationTenant);
// Cada envio dispara WhatsApp de boas-vindas ao número informado: limite por IP contra spam/banimento
const inviteSubmitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
router.post('/invitations/:token/submit', inviteSubmitLimiter, controller.submitInvitation);

// Igreja demonstração: token de 2h do master demo (somente leitura, ver auth.middleware). Sem senha.
const demoLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
router.post('/demo', demoLimiter, async (req, res) => {
  const jwt = require('jsonwebtoken');
  const { garantirDemo } = require('../services/demo.service');
  const { runAsPlatform } = require('../tenancy/context');
  const User = require('../models/User.model');
  const tenant = await garantirDemo();
  if (!tenant) return res.status(404).json({ message: 'Demonstração indisponível no momento' });
  const user = await runAsPlatform(() => User.findOne({ tenantId: tenant._id, role: 'master', login: 'demo', ativo: true }).lean());
  if (!user) return res.status(503).json({ message: 'Demonstração sendo preparada. Tente em instantes.' });
  const token = jwt.sign({ id: user._id, tid: String(tenant._id), role: user.role, demo: true }, process.env.JWT_SECRET, { expiresIn: '2h' });
  return res.json({ token, igreja: tenant.slug });
});

// Cadastro de igreja pela landing page — cria tenant em trial. Limite baixo por IP contra abuso.
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
router.get('/signup/slug/:slug', signup.checkSlug);
router.post('/signup', signupLimiter, signup.signup);

module.exports = router;
