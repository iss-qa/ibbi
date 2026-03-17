const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/user.controller');

const router = express.Router();

router.use(auth);
router.use(requireRole('admin', 'master'));

router.get('/', controller.list);
router.post('/', body('personId').notEmpty(), controller.createUser);
router.put('/:id/role', body('role').isIn(['master', 'admin', 'user']), controller.updateRole);
router.put('/:id/status', body('ativo').isBoolean(), controller.updateStatus);
router.delete('/:id', controller.remove);

module.exports = router;
