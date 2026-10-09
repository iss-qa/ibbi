const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/tenant.controller');

const router = express.Router();

router.use(auth);

// Dados básicos da igreja (qualquer usuário autenticado: branding, congregações, plano)
router.get('/', requirePasswordChanged, controller.get);

router.use(requirePasswordChanged, requireRole('master'));
// Primeiros passos (onboarding) e aceite dos termos
router.get('/onboarding', controller.onboarding);
router.post('/onboarding/confirmar', controller.onboardingConfirmar);
router.post('/onboarding/dispensar', controller.onboardingDispensar);
router.post('/termos/aceitar', controller.aceitarTermos);
router.get('/indicacao', controller.indicacao);
router.put('/settings', controller.updateSettings);
router.get('/whatsapp/status', controller.whatsappStatus);
router.post('/whatsapp/test', controller.whatsappTest);
router.get('/whatsapp/groups', controller.listGroups);
router.post('/whatsapp/groups', controller.createGroup);
router.post('/whatsapp/apresentar', controller.apresentar);
router.get('/webhook-info', controller.webhookInfo);
router.post('/webhook-info/rotate', controller.rotateWebhookToken);
router.get('/billing', controller.billing);
router.put('/billing/plan', controller.changePlan);

module.exports = router;
