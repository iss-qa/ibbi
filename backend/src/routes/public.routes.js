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
router.post('/invitations/:token/submit', controller.submitInvitation);

// Cadastro de igreja pela landing page — cria tenant em trial. Limite baixo por IP contra abuso.
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
router.get('/signup/slug/:slug', signup.checkSlug);
router.post('/signup', signupLimiter, signup.signup);

module.exports = router;
