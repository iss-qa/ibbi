const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/whatsapp-panel.controller');

const router = express.Router();

router.use(auth, requirePasswordChanged, requireRole('admin', 'master'));
router.get('/contacts', controller.contacts);
router.get('/person/:id', controller.thread);

module.exports = router;
