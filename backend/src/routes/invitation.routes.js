const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/invitation.controller');

const router = express.Router();

router.post('/', auth, requireRole('admin', 'master'), controller.createInvitation);

module.exports = router;
