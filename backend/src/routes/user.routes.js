const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/user.controller');

const router = express.Router();

router.use(auth);

// Qualquer usuário autenticado pode alterar sua própria senha (inclusive primeiro login)
router.put('/me/password', body('senhaNova').notEmpty().withMessage('Nova senha é obrigatória'), controller.updateMyPassword);

// Demais rotas exigem senha já trocada + role admin/master
router.use(requirePasswordChanged, requireRole('master', 'admin'));

router.get('/', controller.list);
router.post('/', body('personId').notEmpty(), controller.createUser);
router.put('/:id/role', body('role').isIn(['master', 'admin', 'user']), controller.updateRole);
router.put('/:id/status', body('ativo').isBoolean(), controller.updateStatus);
router.delete('/:id', controller.remove);
router.put('/:id/reset-password', controller.resetPassword);

module.exports = router;
