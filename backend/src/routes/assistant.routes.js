const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/assistant.controller');

const router = express.Router();

const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.use(auth, requirePasswordChanged, requireRole('admin', 'master'));

router.post('/chat', chatLimiter, controller.chat);
router.get('/history', controller.history);
router.delete('/history', controller.clear);

module.exports = router;
