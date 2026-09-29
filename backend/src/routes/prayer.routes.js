const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/prayer.controller');

const router = express.Router();

router.use(auth, requirePasswordChanged);
router.post('/send', body('mensagem').notEmpty().isLength({ max: 3000 }), controller.sendPrayer);
router.get('/', requireRole('admin', 'master'), controller.listPrayers);
router.put('/:id/status', requireRole('admin', 'master'), controller.updateStatus);

module.exports = router;
