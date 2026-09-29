const express = require('express');
const controller = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/evolution/:slug', controller.evolution);
router.get('/whatsapp', controller.cloudVerify);
router.post('/whatsapp', controller.cloudReceive);
router.post('/asaas', controller.asaas);

module.exports = router;
