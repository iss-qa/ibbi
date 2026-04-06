const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/ebd.controller');

const router = express.Router();

router.use(auth, requirePasswordChanged, requireRole('admin', 'master'));

router.get('/', controller.list);
router.get('/domingo/:date', controller.getBySunday);
router.get('/relatorio/classe/:grupo', controller.reportByClasse);
router.get('/relatorio/pessoa/:id', controller.reportByPessoa);
router.get('/relatorio/geral', controller.reportGeral);
router.get('/:id', controller.getById);

router.post('/', requireRole('admin', 'master'), controller.create);
router.put('/:id', requireRole('admin', 'master'), controller.update);
router.put('/:id/presencas', requireRole('admin', 'master'), controller.updatePresencas);
router.delete('/:id', requireRole('master'), controller.remove);

module.exports = router;
