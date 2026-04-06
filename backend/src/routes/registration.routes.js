const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/registration.controller');

const router = express.Router();

router.use(auth, requirePasswordChanged, requireRole('admin', 'master'));

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id/approve', controller.approve);
router.put('/:id/reject', controller.reject);

module.exports = router;
