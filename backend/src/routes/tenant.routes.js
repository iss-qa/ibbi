const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/tenant.controller');

const router = express.Router();

router.use(auth);

// Dados básicos da igreja (qualquer usuário autenticado: branding, congregações, plano)
router.get('/', controller.get);

router.use(requirePasswordChanged, requireRole('master'));
router.put('/settings', controller.updateSettings);
router.get('/whatsapp/status', controller.whatsappStatus);
router.post('/whatsapp/test', controller.whatsappTest);
router.get('/whatsapp/groups', controller.listGroups);
router.post('/whatsapp/groups', controller.createGroup);
router.post('/whatsapp/apresentar', controller.apresentar);
router.get('/webhook-info', controller.webhookInfo);
router.get('/billing', controller.billing);
router.put('/billing/plan', controller.changePlan);

module.exports = router;
