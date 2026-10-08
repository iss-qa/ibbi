const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const controller = require('../controllers/me.controller');

const router = express.Router();

router.use(auth, requirePasswordChanged);
router.get('/whatsapp', controller.whatsappMirror);

module.exports = router;
