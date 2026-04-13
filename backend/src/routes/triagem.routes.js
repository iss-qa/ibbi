const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const ctrl = require('../controllers/triagem.controller');

router.use(auth, requirePasswordChanged);

router.get('/', requireRole('user', 'admin', 'master'), ctrl.list);
router.get('/:id', requireRole('user', 'admin', 'master'), ctrl.getById);
router.post('/', requireRole('admin', 'master'), ctrl.create);
router.put('/:id', requireRole('admin', 'master'), ctrl.update);
router.delete('/:id', requireRole('master'), ctrl.remove);
router.post('/:id/membros', requireRole('admin', 'master'), ctrl.addMembro);
router.delete('/:id/membros/:membroId', requireRole('admin', 'master'), ctrl.removeMembro);

// Atividades
router.post('/:id/atividades/init', requireRole('admin', 'master'), ctrl.initAtividades);
router.post('/:id/atividades', requireRole('admin', 'master'), ctrl.addAtividade);
router.put('/:id/atividades/:atividadeId', requireRole('user', 'admin', 'master'), ctrl.updateAtividade);
router.delete('/:id/atividades/:atividadeId', requireRole('admin', 'master'), ctrl.removeAtividade);
router.post('/:id/atividades/send-whatsapp', requireRole('admin', 'master'), ctrl.sendAtividadesWhatsApp);

// Acompanhados
router.post('/:id/acompanhados', requireRole('admin', 'master'), ctrl.addAcompanhado);
router.delete('/:id/acompanhados/:acompanhadoId', requireRole('admin', 'master'), ctrl.removeAcompanhado);

module.exports = router;
