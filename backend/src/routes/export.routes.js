const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/export.controller');

const router = express.Router();

router.get('/persons', auth, requirePasswordChanged, requireRole('admin', 'master'), controller.exportCsv);

module.exports = router;
