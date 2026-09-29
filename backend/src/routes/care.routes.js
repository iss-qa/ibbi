const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/care.controller');

const router = express.Router();

router.use(auth, requirePasswordChanged, requireRole('admin', 'master'));

router.get('/overview', controller.overview);
router.get('/alerts', controller.listAlerts);
router.put('/alerts/:id', controller.updateAlert);
router.post('/alerts/:id/generate', controller.generateMessage);
router.post('/alerts/:id/send', controller.sendMessage);
router.post('/process-aula/:id', controller.processAula);
router.get('/person/:id', controller.personHistory);

module.exports = router;
