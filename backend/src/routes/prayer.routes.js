const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const controller = require('../controllers/prayer.controller');

const router = express.Router();

router.use(auth, requirePasswordChanged);
router.post('/send', body('mensagem').notEmpty(), controller.sendPrayer);

module.exports = router;
