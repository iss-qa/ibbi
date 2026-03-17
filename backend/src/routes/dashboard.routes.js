const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/', auth, requireRole('admin', 'master'), controller.getDashboard);

module.exports = router;
