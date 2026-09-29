const express = require('express');
const rateLimit = require('express-rate-limit');
const { platformAuth } = require('../middlewares/platformAuth.middleware');
const controller = require('../controllers/platform.controller');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.post('/auth/login', loginLimiter, controller.login);

router.use(platformAuth);
router.get('/auth/me', controller.me);
router.get('/plans', controller.plans);
router.get('/metrics', controller.metrics);

router.get('/tenants', controller.listTenants);
router.post('/tenants', controller.createTenant);
router.get('/tenants/:id', controller.getTenantDetail);
router.put('/tenants/:id', controller.updateTenant);
router.post('/tenants/:id/invoices', controller.generateTenantInvoice);
router.put('/tenants/:id/whatsapp', controller.updateTenantWhatsapp);
router.post('/tenants/:id/whatsapp/test', controller.testTenantWhatsapp);
router.post('/tenants/:id/whatsapp/apresentar', controller.apresentarTenantWhatsapp);

router.get('/invoices', controller.listInvoices);
router.put('/invoices/:id/pay', controller.payInvoice);
router.put('/invoices/:id/cancel', controller.cancelInvoice);
router.post('/invoices/:id/charge', controller.chargeInvoice);
router.post('/billing/run', controller.runBilling);

module.exports = router;
