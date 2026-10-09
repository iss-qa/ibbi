const express = require('express');
const controller = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/evolution/:slug', controller.evolution);
router.get('/whatsapp', controller.cloudVerify);
router.post('/whatsapp', controller.cloudReceive);
// Woovi/OpenPix (cobranças da assinatura) — `/woovi` é apelido da mesma rota
router.post(['/openpix', '/woovi'], controller.openpix);

module.exports = router;
