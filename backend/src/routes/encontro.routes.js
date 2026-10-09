const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const c = require('../controllers/encontro.controller');

const router = express.Router();

router.use(auth, requirePasswordChanged, requireRole('admin', 'master'));

router.get('/grupos', c.listGrupos);
router.post('/grupos', c.createGrupo);
router.get('/grupos/:id', c.getGrupo);
router.put('/grupos/:id', c.updateGrupo);
router.post('/grupos/:id/sincronizar', c.syncMembros);
router.get('/grupos/:id/revisao', c.revisao);
router.post('/grupos/:id/revisao', c.aplicarRevisao);
router.post('/grupos/:id/membros', c.addMembro);
router.delete('/grupos/:id/membros/:personId', c.removeMembro);
router.get('/grupos/:id/frequencia', c.frequencia);
router.get('/grupos/:id/encontros', c.listEncontros);
router.post('/grupos/:id/encontros', c.createEncontro);

router.get('/:id', c.getEncontro);
router.put('/:id', c.updateEncontro);
router.put('/:id/presencas', c.updatePresencas);
router.post('/:id/processar', c.processar);
router.delete('/:id', requireRole('master'), c.removeEncontro);

module.exports = router;
