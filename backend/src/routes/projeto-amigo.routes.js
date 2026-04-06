const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const ctrl = require('../controllers/projeto-amigo.controller');

router.use(auth, requirePasswordChanged);

router.get('/dashboard', requireRole('admin', 'master'), ctrl.dashboard);
router.get('/:referencia_tipo/:referencia_id', requireRole('admin', 'master'), ctrl.listByReferencia);
router.post('/', requireRole('admin', 'master'), ctrl.create);
router.put('/:id', requireRole('admin', 'master'), ctrl.update);
router.delete('/:id', requireRole('admin', 'master'), ctrl.remove);

module.exports = router;
