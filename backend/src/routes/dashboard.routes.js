const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/', auth, requirePasswordChanged, requireRole('admin', 'master'), controller.getDashboard);

module.exports = router;
