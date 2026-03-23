const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/message.controller');

const router = express.Router();

router.use(auth);
router.use(requireRole('admin', 'master'));

router.post('/send-individual', body('mensagem').notEmpty(), controller.sendIndividual);
router.post('/send-by-group', body('grupo').notEmpty(), body('mensagem').notEmpty(), controller.sendByGroup);
router.post(
  '/send-by-congregation',
  body('congregacao').notEmpty(),
  body('mensagem').notEmpty(),
  controller.sendByCongregation
);
router.post('/send-birthday-now', controller.sendBirthdayNow);
router.post('/send-birthday-image', controller.sendBirthdayImage);
router.post('/resend/:id', controller.resendMessage);
router.get('/log', controller.log);
router.get('/prayer-log', controller.prayerLog);
router.get('/queue-status', controller.queueStatus);
router.post('/cancel-queue', controller.cancelQueue);

module.exports = router;
