const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/invitation.controller');

const router = express.Router();

router.post('/', auth, requirePasswordChanged, requireRole('admin', 'master'), controller.createInvitation);

module.exports = router;
