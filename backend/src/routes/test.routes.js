const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/test.controller');

const router = express.Router();

router.post('/send', auth, requireRole('admin', 'master'), controller.testSend);

module.exports = router;
